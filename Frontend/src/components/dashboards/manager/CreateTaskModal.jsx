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
import { CATEGORY_PRESETS } from "../../../lib/taskConstants"
import { getLocalDateString, getInitials } from "../../../lib/taskFormatters"
import { getEmployeeCapacity } from "../../../lib/taskHelpers"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Manager's create-task dialog, relocated as-is (not yet unified with Employee's
// version — that's a later phase). `submitting` is the SAME shared flag the shell's
// useTaskStatusMutation instance uses for approve/reject/review — original code used
// one boolean for both, so it's passed down rather than made locally independent.
// `taskForm`/`customCategoryActive`/`createOpen` are lifted to the shell since
// TeamWorkloadTracker's "assign task to employee" action also opens this modal.
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
      await loadData(user?.id || user?._id)
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
                    const initials = getInitials(emp.name, "EM")
                    return (
                      <SelectItem key={emp._id} value={emp._id}>
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold flex items-center justify-center">
                            {initials}
                          </span>
                          {emp.name}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 flex flex-col">
              <Label htmlFor="task-priority" className="mb-1 text-foreground/80 font-medium">Priority</Label>
              <Select
                value={taskForm.priority}
                onValueChange={val => setTaskForm(f => ({ ...f, priority: val }))}
              >
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Low
                    </span>
                  </SelectItem>
                  <SelectItem value="medium">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500"></span> Medium
                    </span>
                  </SelectItem>
                  <SelectItem value="high">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500"></span> High
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                <div className="space-y-1.5 flex flex-col">
                  <Label htmlFor="task-cat" className="mb-1 text-foreground/80 font-medium">Category</Label>
                  <Select
                    value={customCategoryActive ? "custom" : (CATEGORY_PRESETS.includes(taskForm.category) ? taskForm.category : "General")}
                    onValueChange={val => {
                      if (val === "custom") {
                        setCustomCategoryActive(true);
                        setTaskForm(f => ({ ...f, category: "" }));
                      } else {
                        setCustomCategoryActive(false);
                        setTaskForm(f => ({ ...f, category: val }));
                      }
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_PRESETS.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <SelectItem value="custom">Custom...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

              {customCategoryActive && (
                <div className="space-y-1.5 animate-in fade-in duration-200">
                  <Label htmlFor="task-cat-custom" className="text-foreground/80 font-medium">Custom Category Name *</Label>
                  <Input
                    id="task-cat-custom"
                    value={taskForm.category}
                    onChange={e => setTaskForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="Enter custom category..."
                    className="h-10 rounded-lg"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="task-hours" className="text-foreground/80 font-medium">Estimated Hours</Label>
                  <Input
                    type="number"
                    id="task-hours"
                    value={taskForm.estimatedHours}
                    onChange={e => setTaskForm(f => ({ ...f, estimatedHours: Number(e.target.value) }))}
                    min="0"
                    className="h-10 rounded-lg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="task-due" className="text-foreground/80 font-medium">Due Date</Label>
                  <Input
                    type="date"
                    id="task-due"
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="h-10 rounded-lg text-foreground bg-transparent"
                  />
                </div>
              </div>
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
