import { useState } from "react"
import axios from "axios"
import API_BASE from "../../../lib/api"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORY_PRESETS } from "../../../lib/taskConstants"
import { getLocalDateString } from "../../../lib/taskFormatters"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"

// Employee's self-assigned create-task dialog, relocated as-is (not yet unified with
// Manager's version — that's a later phase). No assignee select (self-assigned), and
// no "advanced settings" toggle — simpler than Manager's form. `submitting` is the
// SAME shared flag the shell's useTaskStatusMutation instance uses for the status
// stepper — original code used one boolean for both, so it's passed down rather than
// made locally independent. `createOpen` is lifted to the shell (its button opens
// this modal); `taskForm`/`customCategoryActive` stay local — nothing else reads them.
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
