import { useState, useMemo } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { CategorySelect, PrioritySelect, HoursAndDueDateRow } from "./TaskFormFields"
import PersonAvatar from "@/components/ui/person-avatar"
import { getLocalDateString } from "../../lib/taskFormatters"
import { emptyTaskForm } from "../../lib/taskFormState"
import { getEmployeeCapacity, CAPACITY_REASON_LABELS } from "../../lib/taskHelpers"
import useManagerDashboardStore from "../../store/useManagerDashboardStore"
import useCalendarStore from "../../store/useCalendarStore"
import { useToast } from "../../context/ToastContext"

// Manager/admin task form, used for BOTH creating and editing — the two take an
// identical field set, and the capacity-warning banner has one subtle difference
// between them (see `capacityWarning` below) that would silently drift if this were
// two components. (Contrast decisions.md §9: Manager's and Employee's *create* modals
// stay separate because they genuinely diverge on assignee/department/capacity.)
//
// State-lifting is unchanged from the original CreateTaskModal: taskForm/createOpen
// live in the shell so TeamWorkloadTracker's "assign task to employee" can open it
// pre-filled. `submitting` is the same shared flag the shell's mutation hooks use.
//
// Props beyond the original:
//   mode      — "create" | "edit"
//   editTask  — the task being edited (edit mode only)
//   onSave    — async (fields) => ({ success }), supplied by the shell so the edit path
//               goes through its useTaskMutation instance (optimistic + rollback)

const TaskFormModal = ({
  createOpen, setCreateOpen,
  taskForm, setTaskForm,
  customCategoryActive, setCustomCategoryActive,
  submitting, setSubmitting,
  user,
  mode = "create",
  editTask = null,
  onSave
}) => {
  const employees = useManagerDashboardStore(s => s.employees)
  const departments = useManagerDashboardStore(s => s.departments)
  const tasks = useManagerDashboardStore(s => s.tasks)
  const loadData = useManagerDashboardStore(s => s.loadData)
  const calendar = useCalendarStore(s => s.calendar)

  const [showAdvancedTaskForm, setShowAdvancedTaskForm] = useState(false)
  const toast = useToast()

  const isEdit = mode === "edit"

  // Capacity preview (Locked Logic §6) for whichever day the task is due.
  //
  // Create: the task doesn't exist yet, so its hours are added on top of the
  // assignee's existing planned load.
  //
  // Edit: the task is ALREADY counted in `tasks` with its old hours/date/assignee, so
  // adding the new hours on top would double-count it and make every edit look like it
  // doubles the load. Instead we project the edited values into a copy of the list and
  // measure that — which also handles a changed due date (moves the load to another
  // day) and a changed assignee (moves it to another person) correctly, with no
  // delta arithmetic to get wrong.
  const projectedTasks = useMemo(() => {
    if (!isEdit || !editTask) return tasks
    return tasks.map(t => t._id === editTask._id
      ? {
          ...t,
          estimatedHours: Number(taskForm.estimatedHours) || 0,
          dueDate: taskForm.dueDate || null,
          assignedTo: { _id: taskForm.assignedTo }
        }
      : t)
  }, [tasks, isEdit, editTask, taskForm.estimatedHours, taskForm.dueDate, taskForm.assignedTo])

  const assignee = employees.find(emp => emp._id === taskForm.assignedTo)
  const capacityWarning = assignee && taskForm.dueDate
    ? (isEdit
        ? getEmployeeCapacity(assignee, projectedTasks, 0, new Date(taskForm.dueDate), calendar)
        : getEmployeeCapacity(assignee, tasks, taskForm.estimatedHours || 0, new Date(taskForm.dueDate), calendar))
    : null
  const isCapacityWarningToday = taskForm.dueDate === getLocalDateString()

  const resetForm = () => {
    setTaskForm(emptyTaskForm())
    setCustomCategoryActive(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!taskForm.assignedTo) {
      toast.error(`Please select an assignee before ${isEdit ? "saving" : "creating"} the task.`)
      return
    }

    if (isEdit) {
      // Send the full editable set — the server diffs it and records only what actually
      // changed, so there's no need to track dirty fields here.
      const result = await onSave({
        title: taskForm.title,
        description: taskForm.description,
        category: taskForm.category,
        priority: taskForm.priority,
        estimatedHours: Number(taskForm.estimatedHours) || 0,
        dueDate: taskForm.dueDate || null,
        assignedTo: taskForm.assignedTo,
        department: taskForm.department || null
      })
      if (result?.success) {
        setCreateOpen(false)
        toast.success("Task updated.")
        if (result.warning) toast.warning(result.warning)
      }
      // On failure the dialog stays open with the user's input intact (§18) — the
      // global axios interceptor has already surfaced the reason.
      return
    }

    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadData(user?.id || user?._id, user?.role)
      setCreateOpen(false)
      resetForm()
    } catch (err) {
      console.error("Error creating task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  // A daily task belongs to one employee by construction (the provisioning service
  // matches on assignedTo + templateRef + dailyDate), so reassigning one is rejected
  // server-side — disable the control rather than let the user try.
  const assigneeLocked = isEdit && Boolean(editTask?.isDaily)

  return (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="sm:max-w-[500px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {isEdit ? "Edit Task" : "Create New Task"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details, re-estimate, reschedule, or reassign this task."
              : "Assign tasks, set estimate hours, and select priorities"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title" className="text-foreground/80 font-medium">Title *</Label>
            <Input
              id="task-title"
              value={taskForm.title}
              onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Build API login workflow"
              className="h-10 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 flex flex-col">
              <Label htmlFor="task-assignee" className="mb-1 text-foreground/80 font-medium">Assigned To *</Label>
              <Select
                value={taskForm.assignedTo}
                disabled={assigneeLocked}
                onValueChange={val => {
                  const chosenEmp = employees.find(emp => emp._id === val)
                  const deptId = chosenEmp?.department?._id || chosenEmp?.department || ""
                  setTaskForm(f => ({ ...f, assignedTo: val, department: deptId }))
                }}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="— Select Assignee —" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(emp => {
                    // Remaining capacity for the task's due date, so the manager can
                    // choose on the basis they actually care about.
                    const cap = taskForm.dueDate
                      ? getEmployeeCapacity(emp, isEdit ? projectedTasks : tasks, 0, new Date(taskForm.dueDate), calendar)
                      : null
                    return (
                      <SelectItem key={emp._id} value={emp._id}>
                        <span className="flex items-center gap-2">
                          <PersonAvatar name={emp.name} seed={emp._id} fallback="EM" className="h-4 w-4 text-[8px]" />
                          {emp.name}
                          {cap && (
                            <span className={`text-[10px] font-semibold ${
                              cap.capacityHours === 0 ? "text-muted-foreground/70"
                                : cap.isOverCapacity ? "text-destructive" : "text-muted-foreground"
                            }`}>
                              {cap.capacityHours === 0
                                ? `· ${cap.holidayName || CAPACITY_REASON_LABELS[cap.capacityReason] || "unavailable"}`
                                : cap.isOverCapacity ? "· over capacity" : `· ${Math.max(0, cap.remainingHours)}h free`}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {assigneeLocked && (
                <p className="text-[10px] text-muted-foreground">
                  Daily tasks are generated per employee and can't be reassigned.
                </p>
              )}
            </div>
            <PrioritySelect
              priority={taskForm.priority}
              onChange={val => setTaskForm(f => ({ ...f, priority: val }))}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-border/40 py-2"
            onClick={() => setShowAdvancedTaskForm(!showAdvancedTaskForm)}
          >
            {showAdvancedTaskForm ? "▲ Hide Advanced Settings" : "▼ Show Advanced Settings (Description, Category, Dept, Hours, Due Date)"}
          </Button>

          {showAdvancedTaskForm && (
            <div className="space-y-4 border-t border-border/40 pt-4 animate-in fade-in duration-200">
              <div className="space-y-1.5">
                <Label htmlFor="task-desc" className="text-foreground/80 font-medium">Description</Label>
                <Textarea
                  id="task-desc"
                  value={taskForm.description}
                  onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Add task specification details..."
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
                <div className="space-y-1.5 flex flex-col">
                  <Label htmlFor="task-dept" className="mb-1 text-foreground/80 font-medium">Department</Label>
                  <Select
                    value={taskForm.department || "none"}
                    onValueChange={val => setTaskForm(f => ({ ...f, department: val === "none" ? "" : val }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="— None —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <HoursAndDueDateRow
                estimatedHours={taskForm.estimatedHours}
                dueDate={taskForm.dueDate}
                onHoursChange={hours => setTaskForm(f => ({ ...f, estimatedHours: hours }))}
                onDueDateChange={date => setTaskForm(f => ({ ...f, dueDate: date }))}
              />
            </div>
          )}

          {capacityWarning?.capacityHours === 0 && assignee && taskForm.dueDate && (
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {assignee.name} is unavailable on {new Date(taskForm.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" "}({(capacityWarning.holidayName || CAPACITY_REASON_LABELS[capacityWarning.capacityReason] || "no capacity").toLowerCase()}).
                You can still assign it — consider a different due date.
              </span>
            </div>
          )}

          {capacityWarning?.isOverCapacity && capacityWarning.capacityHours > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {isEdit ? (
                  <>
                    This leaves {assignee.name} planned for {capacityWarning.plannedHours}h
                    {isCapacityWarningToday ? " today" : ` on ${new Date(taskForm.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    {" "}against a {capacityWarning.capacityHours}h capacity — over their limit.
                  </>
                ) : (
                  <>
                    {assignee.name} is already planned for {capacityWarning.plannedHours}h
                    {isCapacityWarningToday ? " today" : ` on ${new Date(taskForm.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    {" "}against a {capacityWarning.capacityHours}h capacity — this assignment pushes them over.
                  </>
                )}
              </span>
            </div>
          )}

          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-lg h-10 shadow font-semibold" disabled={submitting}>
              {submitting ? (isEdit ? "Saving…" : "Creating…") : (isEdit ? "Save Changes" : "Assign Task")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default TaskFormModal
