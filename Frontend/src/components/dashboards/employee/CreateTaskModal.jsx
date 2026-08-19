import { useState } from "react"
import axios from "axios"
import API_BASE from "../../../lib/api"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CategorySelect, PrioritySelect, HoursAndDueDateRow } from "../../tasks/TaskFormFields"
import { getLocalDateString } from "../../../lib/taskFormatters"
import { taskToForm } from "../../../lib/taskFormState"
import { CATEGORY_PRESETS } from "../../../lib/taskConstants"
import { useToast } from "../../../context/ToastContext"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"
import { useAuth } from "../../../context/AuthContext"

// Employee's self-assigned create-task dialog. Shares its Category/Priority/
// Hours+Due fields with Manager's version via ../../tasks/TaskFormFields. No assignee
// select (self-assigned), and no "advanced settings" toggle — simpler than Manager's
// form. `submitting` is the SAME shared flag the shell's useTaskStatusMutation
// instance uses for the status stepper — original code used one boolean for both, so
// it's passed down rather than made locally independent. `createOpen` is lifted to
// the shell (its button opens this modal); `taskForm`/`customCategoryActive` stay
// local — nothing else reads them.
//
// Also serves EDIT for a task the employee created themselves (mode="edit"). The
// backend already allowed this (EMPLOYEE_EDITABLE_FIELDS) — the field set is identical
// to create minus `assignedTo`, which an employee may never change, so one form covers
// both rather than a near-duplicate component.
const BLANK = () => ({
  title: "", description: "", category: "General",
  priority: "medium", estimatedHours: 0, dueDate: getLocalDateString()
})

const CreateTaskModal = ({ createOpen, setCreateOpen, submitting, setSubmitting, mode = "create", editTask = null, onSave }) => {
  const loadTasks = useEmployeeDashboardStore(s => s.loadTasks)
  const { user } = useAuth()
  const userId = user?.id || user?._id
  const toast = useToast()
  const isEdit = mode === "edit"

  const [taskForm, setTaskForm] = useState(BLANK())
  const [customCategoryActive, setCustomCategoryActive] = useState(false)

  // The shell's "Create Task" button used to reset this directly on click
  // (`setCreateOpen(true); setCustomCategoryActive(false)`). Now that this state is
  // local to the modal, mirror that exact reset whenever the dialog opens by adjusting
  // state during render (React's recommended alternative to an effect for this) rather
  // than in a useEffect, which would fire a redundant extra render.
  // Same render-time adjustment now also seeds the form from the task being edited.
  const [prevKey, setPrevKey] = useState(null)
  const openKey = createOpen ? `${mode}:${editTask?._id || "new"}` : null
  if (openKey !== prevKey) {
    setPrevKey(openKey)
    if (createOpen) {
      if (isEdit && editTask) {
        const seeded = taskToForm(editTask)
        setTaskForm({
          title: seeded.title, description: seeded.description, category: seeded.category,
          priority: seeded.priority, estimatedHours: seeded.estimatedHours, dueDate: seeded.dueDate
        })
        setCustomCategoryActive(!CATEGORY_PRESETS.includes(editTask.category))
      } else {
        setTaskForm(BLANK())
        setCustomCategoryActive(false)
      }
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()

    if (isEdit) {
      const result = await onSave({
        title: taskForm.title,
        description: taskForm.description,
        category: taskForm.category,
        priority: taskForm.priority,
        estimatedHours: Number(taskForm.estimatedHours) || 0,
        dueDate: taskForm.dueDate || null
      })
      if (result?.success) {
        setCreateOpen(false)
        toast.success("Task updated.")
        if (result.warning) toast.warning(result.warning)
      }
      // On failure the dialog stays open with input intact — the global interceptor
      // has already surfaced why.
      return
    }

    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadTasks(userId)
      setCreateOpen(false)
      setTaskForm(BLANK())
      setCustomCategoryActive(false)
    } catch (err) {
      console.error("Error creating self-assigned task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="sm:max-w-[480px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {isEdit ? "Edit Task" : "Create Self Task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of a task you created."
              : "Define a task to work on. It will be assigned to yourself automatically."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTask} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-foreground/80 font-medium">Title *</Label>
            <Input
              id="task-title"
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Wire up UI context"
              className="h-10 rounded-lg"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-desc" className="text-foreground/80 font-medium">Description</Label>
            <Textarea
              id="task-desc"
              value={taskForm.description}
              onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Task specifications..."
              className="rounded-lg"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CategorySelect
              category={taskForm.category}
              customActive={customCategoryActive}
              onSelectChange={val => {
                if (val === "custom") {
                  setCustomCategoryActive(true)
                  setTaskForm(f => ({ ...f, category: "" }))
                } else {
                  setCustomCategoryActive(false)
                  setTaskForm(f => ({ ...f, category: val }))
                }
              }}
              onCustomTextChange={text => setTaskForm(f => ({ ...f, category: text }))}
            />
            <PrioritySelect
              priority={taskForm.priority}
              onChange={val => setTaskForm(f => ({ ...f, priority: val }))}
            />
          </div>

          <HoursAndDueDateRow
            estimatedHours={taskForm.estimatedHours}
            dueDate={taskForm.dueDate}
            onHoursChange={hours => setTaskForm(f => ({ ...f, estimatedHours: hours }))}
            onDueDateChange={date => setTaskForm(f => ({ ...f, dueDate: date }))}
          />
          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-lg h-10 shadow font-semibold" disabled={submitting}>
              {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Add Task")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTaskModal
