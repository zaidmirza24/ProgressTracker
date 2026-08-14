import { useState } from "react"
import axios from "axios"
import API_BASE from "../../../lib/api"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle } from "lucide-react"
import { CategorySelect, PrioritySelect, HoursAndDueDateRow } from "../../tasks/TaskFormFields"
import PersonAvatar from "@/components/ui/person-avatar"
import { getLocalDateString } from "../../../lib/taskFormatters"
import { getEmployeeCapacity } from "../../../lib/taskHelpers"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Manager's create-task dialog. Shares its Category/Priority/Hours+Due fields with
// Employee's version via ../../tasks/TaskFormFields — the two forms still diverge on
// state-lifting (this one lifts taskForm/createOpen to the shell so
// TeamWorkloadTracker's "assign task to employee" action can open it pre-filled;
// Employee's keeps its form state local, since nothing else opens it pre-filled) and
// on fields only a manager needs (Assignee, Department, capacity warning, the
// Advanced Settings toggle). `submitting` is the SAME shared flag the shell's
// useTaskStatusMutation instance uses for approve/reject/review — original code used
// one boolean for both, so it's passed down rather than made locally independent.
// `showAdvancedTaskForm` stays local — no other component reads it.
const CreateTaskModal = ({
  createOpen, setCreateOpen,
  taskForm, setTaskForm,
  customCategoryActive, setCustomCategoryActive,
  submitting, setSubmitting,
  user
}) => {
  const employees = useManagerDashboardStore(s => s.employees)
  const departments = useManagerDashboardStore(s => s.departments)
  const tasks = useManagerDashboardStore(s => s.tasks)
  const loadData = useManagerDashboardStore(s => s.loadData)

  const [showAdvancedTaskForm, setShowAdvancedTaskForm] = useState(false)

  // Capacity preview (Locked Logic §6) for whichever day the task is due — the V2
  // forecast (TeamWorkloadTracker's week grid) means this isn't limited to "today" only.
  const assignee = employees.find(emp => emp._id === taskForm.assignedTo)
  const capacityWarning = assignee && taskForm.dueDate
    ? getEmployeeCapacity(assignee, tasks, taskForm.estimatedHours || 0, new Date(taskForm.dueDate))
    : null
  const isCapacityWarningToday = taskForm.dueDate === getLocalDateString()

  const handleCreateTask = async (e) => {
    e.preventDefault()
    if (!taskForm.assignedTo) return
    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadData(user?.id || user?._id, user?.role)
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        department: "", assignedTo: "", priority: "medium",
        estimatedHours: 0, dueDate: getLocalDateString()
      })
      setCustomCategoryActive(false)
    } catch (err) {
      console.error("Error creating task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="sm:max-w-[500px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create New Task</DialogTitle>
          <DialogDescription>Assign tasks, set estimate hours, and select priorities</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateTask} className="space-y-4 py-2">
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
                    return (
                      <SelectItem key={emp._id} value={emp._id}>
                        <span className="flex items-center gap-2">
                          <PersonAvatar name={emp.name} seed={emp._id} fallback="EM" className="h-4 w-4 text-[8px]" />
                          {emp.name}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
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

          {capacityWarning?.isOverCapacity && (
            <div className="flex items-center gap-2 text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                {assignee.name} is already planned for {capacityWarning.plannedHours}h
                {isCapacityWarningToday ? " today" : ` on ${new Date(taskForm.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                {" "}against a {capacityWarning.capacityHours}h capacity — this assignment pushes them over.
              </span>
            </div>
          )}

          <DialogFooter className="pt-4 gap-2">
            <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-lg h-10 shadow font-semibold" disabled={submitting}>
              {submitting ? "Creating…" : "Assign Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default CreateTaskModal
