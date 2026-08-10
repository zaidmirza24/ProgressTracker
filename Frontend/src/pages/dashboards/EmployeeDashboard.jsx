import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import { useTimer } from "../../context/TimerContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ClipboardList, CheckCircle2, Clock, Calendar,
  MessageSquare, Send, User, BarChart3,
  Play, Pause, Square, AlertCircle, Plus, Check
} from "lucide-react"

const STATUS_VARIANTS = {
  "Not Started": "secondary",
  "Accepted": "outline",
  "In Progress": "violet",
  "Waiting for Review": "warning",
  "Completed": "success",
  "Approved": "success",
  "Rejected": "destructive",
  "Reopened": "info"
}

const PRIORITY_VARIANTS = {
  low: "outline",
  medium: "secondary",
  high: "destructive"
}

const EmployeeDashboard = () => {
  const { user } = useAuth()
  const { activeSession, elapsedSeconds, isRunning, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailTask, setDetailTask] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  
  // Forms
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "General",
    priority: "medium", estimatedHours: 0, dueDate: ""
  })
  const [transitionComment, setTransitionComment] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/tasks`)
      setTasks(res.data.tasks)
    } catch (err) {
      console.error("Error loading employee tasks:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  // Sync details dialog with updated task context if it changes in the list
  useEffect(() => {
    if (detailTask) {
      const updated = tasks.find(t => t._id === detailTask._id)
      if (updated) setDetailTask(updated)
    }
  }, [tasks])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadTasks()
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        priority: "medium", estimatedHours: 0, dueDate: ""
      })
    } catch (err) {
      console.error("Error creating self-assigned task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusTransition = async (newStatus, taskId = null) => {
    const targetTaskId = taskId || detailTask?._id
    if (!targetTaskId) return
    setSubmitting(true)
    try {
      const res = await axios.put(`${API_BASE}/api/tasks/${targetTaskId}/status`, {
        status: newStatus,
        comment: transitionComment
      })
      if (detailTask && detailTask._id === targetTaskId) {
        setDetailTask(res.data.task)
      }
      setTransitionComment("")
      await loadTasks()
    } catch (err) {
      console.error("Error updating status:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !detailTask) return
    try {
      const res = await axios.post(`${API_BASE}/api/tasks/${detailTask._id}/comments`, {
        text: newComment
      })
      setDetailTask(res.data.task)
      setNewComment("")
      await loadTasks()
    } catch (err) {
      console.error("Error adding comment:", err)
    }
  }

  const handlePlayRow = async (e, taskId) => {
    e.stopPropagation()
    await startTimer(taskId)
    await loadTasks() // Refresh task state in case status updated to In Progress
  }

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = Math.floor(totalSecs % 60)
    const pad = (num) => String(num).padStart(2, "0")
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    return `${pad(mins)}:${pad(secs)}`
  }

  // Get available transitions based on task type (self-assigned vs manager-assigned)
  const getNextStatuses = (task) => {
    const isSelfCreated = task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo

    if (isSelfCreated) {
      switch (task.status) {
        case "Not Started": return ["Accepted"]
        case "Accepted": return ["In Progress"]
        case "In Progress": return ["Completed"]
        case "Approved": return ["In Progress"] // Allow reopening self task
        default: return []
      }
    } else {
      switch (task.status) {
        case "Not Started": return ["Accepted"]
        case "Accepted": return ["In Progress"]
        case "In Progress": return ["Waiting for Review"]
        case "Rejected":
        case "Reopened": return ["In Progress"] // Allow starting rejected/reopened tasks
        default: return []
      }
    }
  }

  // Visual Stepper steps configuration
  const getStepperSteps = (task) => {
    const isSelfCreated = task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo
    if (isSelfCreated) {
      return [
        { label: "Not Started", key: "Not Started" },
        { label: "Accepted", key: "Accepted" },
        { label: "In Progress", key: "In Progress" },
        { label: "Completed", key: "Approved" } // Handled as Approved internally
      ]
    } else {
      return [
        { label: "Not Started", key: "Not Started" },
        { label: "Accepted", key: "Accepted" },
        { label: "In Progress", key: "In Progress" },
        { label: "In Review", key: "Waiting for Review" },
        { label: "Approved", key: "Approved" }
      ]
    }
  }

  // Metrics
  const activeCount = tasks.filter(t => ["In Progress", "Accepted"].includes(t.status)).length
  const completedCount = tasks.filter(t => ["Approved", "Completed"].includes(t.status)).length

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            My Workspace
          </h2>
          <p className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{user?.name}</strong>. Start timers on your assigned tasks, record log hours, and submit work reviews.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" /> Create Task
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Tasks</CardTitle>
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending start or execution</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Work Session</CardTitle>
            <Clock className={`h-4.5 w-4.5 ${activeSession ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
              {activeSession ? formatTime(elapsedSeconds) : "00:00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {activeSession ? `${activeSession.task?.title}` : "No active timer"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Marked completed or approved</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-info rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work Log Status</CardTitle>
            <Clock className="h-4.5 w-4.5 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-info-foreground">Unfiled</div>
            <p className="text-xs text-muted-foreground mt-1">Daily productivity log pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold">My Assigned Tasks</CardTitle>
            <CardDescription>Track status changes and active timers below</CardDescription>
          </div>
          <Badge variant="outline" className="h-6 font-mono rounded-lg">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Assigned By</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Status Workflow</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-center">Track Time</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Clock className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Loading assigned tasks...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16">
                      <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground">No tasks assigned</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Once your manager assigns a task to your name or you create one yourself, it will show up here.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map(t => {
                    const isTaskActive = activeSession && activeSession.task?._id === t._id
                    const nextOptions = getNextStatuses(t)
                    const isSelfCreated = t.assignedBy?._id === t.assignedTo?._id || t.assignedBy === t.assignedTo
                    
                    return (
                      <TableRow
                        key={t._id}
                        className={`hover:bg-muted/30 cursor-pointer transition-colors ${
                          isTaskActive ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : ""
                        }`}
                        onClick={() => setDetailTask(t)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors flex items-center gap-1.5">
                              {t.title}
                              {isSelfCreated && (
                                <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                              )}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{t.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {t.assignedBy?.name ? t.assignedBy.name[0].toUpperCase() : "M"}
                            </div>
                            <span>{isSelfCreated ? "Self-Assigned" : (t.assignedBy?.name || "Manager")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[10px] py-0.5 px-2 rounded-md font-bold">
                            {t.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {t.dueDate ? (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {nextOptions.length > 0 ? (
                            <select
                              value={t.status}
                              onChange={e => {
                                handleStatusTransition(e.target.value, t._id)
                              }}
                              className="h-8 rounded-lg border border-input bg-card text-foreground px-2 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value={t.status}>{t.status}</option>
                              {nextOptions.map(opt => (
                                <option key={opt} value={opt}>➔ {opt === "Completed" ? "Complete Task" : opt}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                              {t.status === "Approved" && isSelfCreated ? "Completed" : t.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          {isTaskActive ? (
                            <div className="flex items-center justify-center gap-1">
                              {isRunning ? (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10" 
                                  onClick={pauseTimer}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-lg text-green-500 hover:text-green-600 hover:bg-green-500/10" 
                                  onClick={resumeTimer}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" 
                                onClick={stopTimer}
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            !["Completed", "Approved"].includes(t.status) && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" 
                                onClick={e => handlePlayRow(e, t._id)}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div 
                                className="bg-primary h-full rounded-full transition-all duration-300"
                                style={{ width: `${t.progressPercentage}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs font-semibold text-foreground/80">
                              {t.progressPercentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Task Modal */}
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
              <div className="space-y-1.5">
                <Label htmlFor="task-cat" className="text-foreground/80 font-medium">Category</Label>
                <Input
                  id="task-cat"
                  value={taskForm.category}
                  onChange={e => setTaskForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Design"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-priority" className="mb-1 text-foreground/80 font-medium">Priority</Label>
                <select
                  id="task-priority"
                  value={taskForm.priority}
                  onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="low" className="bg-card text-foreground">Low</option>
                  <option value="medium" className="bg-card text-foreground">Medium</option>
                  <option value="high" className="bg-card text-foreground">High</option>
                </select>
              </div>
            </div>
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

      {/* Task Detail Modal */}
      <Dialog open={detailTask !== null} onOpenChange={() => setDetailTask(null)}>
        {detailTask && (
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto border-border/60">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6 gap-4">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{detailTask.title}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[detailTask.status] || "default"} className="font-bold shrink-0">
                  {(detailTask.assignedBy?._id === detailTask.assignedTo?._id || detailTask.assignedBy === detailTask.assignedTo) && detailTask.status === "Approved" ? "Completed" : detailTask.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs uppercase tracking-wider font-semibold text-primary">{detailTask.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* VISUAL WORKFLOW STEPPER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workflow Timeline</h4>
                <div className="flex items-center justify-between relative px-2 py-4 bg-muted/20 border border-border/30 rounded-xl overflow-x-auto">
                  {getStepperSteps(detailTask).map((step, idx, arr) => {
                    const isSelfCreated = detailTask.assignedBy?._id === detailTask.assignedTo?._id || detailTask.assignedBy === detailTask.assignedTo
                    
                    // Determine status active / completed status
                    const currentIdx = arr.findIndex(s => s.key === detailTask.status)
                    const isCompleted = idx < currentIdx || detailTask.status === "Approved" || detailTask.status === "Completed"
                    const isActive = idx === currentIdx && detailTask.status !== "Approved" && detailTask.status !== "Completed"
                    const isClickable = idx === currentIdx + 1 && !["Approved", "Completed"].includes(detailTask.status)

                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                          <button
                            type="button"
                            disabled={!isClickable || submitting}
                            onClick={() => handleStatusTransition(step.key === "Approved" && isSelfCreated ? "Completed" : step.key)}
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCompleted 
                                ? "bg-green-500 text-white shadow-sm border border-green-600" 
                                : isActive 
                                  ? "bg-primary text-primary-foreground font-extrabold ring-4 ring-primary/20 scale-110" 
                                  : isClickable 
                                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 cursor-pointer animate-pulse" 
                                    : "bg-muted/80 text-muted-foreground border border-border"
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </button>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${
                            isActive ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={`h-0.5 flex-1 min-w-[30px] mx-2 ${
                            isCompleted ? "bg-green-500" : "bg-border"
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Task Details Info */}
              <div className="grid grid-cols-2 gap-4 text-xs border-y border-border/40 py-4 bg-muted/10 px-3 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>Assigned By: <strong className="text-foreground">{detailTask.assignedBy?.name || "Manager"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Due: <strong className="text-foreground">{detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString() : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Est. Hours: <strong className="text-foreground">{detailTask.estimatedHours} hrs</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>Progress: <strong className="text-foreground">{detailTask.progressPercentage}%</strong></span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</h4>
                <p className="text-sm text-foreground bg-muted/20 p-3 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed">
                  {detailTask.description || "No description provided."}
                </p>
              </div>

              {/* Task Timer Panel */}
              {!["Completed", "Approved"].includes(detailTask.status) && (
                <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-gradient-to-r from-card to-card/60 flex items-center justify-between shadow-sm relative overflow-hidden">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
                      <Clock className="h-4 w-4 text-primary" />
                      Time Tracking
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {activeSession && activeSession.task?._id === detailTask._id
                        ? "Currently active on your sidebar"
                        : "Start a timer session to begin"}
                    </p>
                  </div>
                  <div>
                    {activeSession && activeSession.task?._id === detailTask._id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold tracking-tight bg-muted border border-border px-3 py-1.5 rounded-lg">
                          {formatTime(elapsedSeconds)}
                        </span>
                        {isRunning ? (
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg" onClick={pauseTimer}>
                            <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg" onClick={resumeTimer}>
                            <Play className="h-3.5 w-3.5 mr-1 text-primary" /> Resume
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="h-8 px-3 rounded-lg" onClick={stopTimer}>
                          <Square className="h-3.5 w-3.5 mr-1" /> Stop
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="rounded-lg shadow font-semibold" onClick={() => startTimer(detailTask._id)}>
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Start Timer
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Activity Stream ({detailTask.comments.length})
                </h4>

                {/* Comment log stream */}
                <ScrollArea className="h-[150px] border border-border/40 rounded-xl bg-muted/10 p-3">
                  {detailTask.comments.length === 0 ? (
                    <div className="h-full flex items-center justify-center py-8">
                      <p className="text-xs text-muted-foreground italic">No activities logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailTask.comments.map(c => {
                        const authorInitials = c.author?.name ? c.author.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "US"
                        return (
                          <div key={c._id} className="text-xs flex gap-2.5 items-start">
                            <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-[9px] shrink-0">
                              {authorInitials}
                            </div>
                            <div className="flex-1 bg-card/60 p-2.5 rounded-lg border border-border/30 space-y-1 shadow-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-foreground/80">{c.author?.name} <span className="text-[10px] text-muted-foreground font-normal">({c.author?.role})</span></span>
                                <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{c.text}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Post comment form */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <Input
                    placeholder="Write a message..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 h-9 text-xs rounded-lg"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 rounded-lg shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

export default EmployeeDashboard
