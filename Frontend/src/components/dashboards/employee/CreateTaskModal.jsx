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
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"

// Employee's self-assigned create-task dialog. Shares its Category/Priority/
// Hours+Due fields with Manager's version via ../../tasks/TaskFormFields. No assignee
// select (self-assigned), and no "advanced settings" toggle — simpler than Manager's
// form. `submitting` is the SAME shared flag the shell's useTaskStatusMutation
// instance uses for the status stepper — original code used one boolean for both, so
// it's passed down rather than made locally independent. `createOpen` is lifted to
// the shell (its button opens this modal); `taskForm`/`customCategoryActive` stay
// local — nothing else reads them.
const CreateTaskModal = ({ createOpen, setCreateOpen, submitting, setSubmitting }) => {
  const loadTasks = useEmployeeDashboardStore(s => s.loadTasks)

  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "General",
    priority: "medium", estimatedHours: 0, dueDate: getLocalDateString()
  })
  const [customCategoryActive, setCustomCategoryActive] = useState(false)

  // The shell's "Create Task" button used to reset this directly on click
  // (`setCreateOpen(true); setCustomCategoryActive(false)`). Now that this state is
  // local to the modal, mirror that exact reset whenever the dialog opens by adjusting
  // state during render (React's recommended alternative to an effect for this) rather
  // than in a useEffect, which would fire a redundant extra render.
  const [prevCreateOpen, setPrevCreateOpen] = useState(createOpen)
  if (createOpen !== prevCreateOpen) {
    setPrevCreateOpen(createOpen)
    if (createOpen) {
      setCustomCategoryActive(false)
    }
  }

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadTasks()
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        priority: "medium", estimatedHours: 0, dueDate: getLocalDateString()
      })
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
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create Self Task</DialogTitle>
          <DialogDescription>Define a task to work on. It will be assigned to yourself automatically.</DialogDescription>
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
              {submitting ? "Creating…" : "Add Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTaskModal
