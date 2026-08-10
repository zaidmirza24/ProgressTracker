import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { useTimer } from "../../context/TimerContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  ClipboardList, CheckCircle2, Clock, Calendar,
  MessageSquare, Send, User, BarChart3,
  Play, Pause, Square
} from "lucide-react"

const STATUS_VARIANTS = {
  "Not Started": "secondary",
  "Accepted": "outline",
  "In Progress": "default",
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
  
  // Forms
  const [transitionComment, setTransitionComment] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const loadTasks = async () => {
    try {
      const res = await axios.get("http://localhost:3000/api/tasks")
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

  const handleStatusTransition = async (newStatus) => {
    if (!detailTask) return
    setSubmitting(true)
    try {
      const res = await axios.put(`http://localhost:3000/api/tasks/${detailTask._id}/status`, {
        status: newStatus,
        comment: transitionComment
      })
      setDetailTask(res.data.task)
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
      const res = await axios.post(`http://localhost:3000/api/tasks/${detailTask._id}/comments`, {
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

  // Helper to determine next transition options
  const renderTransitionButtons = (task) => {
    const btnStyle = "w-full sm:w-auto"
    switch (task.status) {
      case "Not Started":
        return (
          <Button
            className={btnStyle}
            onClick={() => handleStatusTransition("Accepted")}
            disabled={submitting}
          >
            Accept Task
          </Button>
        )
      case "Accepted":
      case "Reopened":
      case "Rejected":
        return (
          <Button
            className={btnStyle}
            onClick={() => handleStatusTransition("In Progress")}
            disabled={submitting}
          >
            Start Work
          </Button>
        )
      case "In Progress":
        return (
          <Button
            className={btnStyle}
            onClick={() => handleStatusTransition("Waiting for Review")}
            disabled={submitting}
          >
            Submit for Review
          </Button>
        )
      default:
        return null
    }
  }

  // Metrics
  const activeCount = tasks.filter(t => t.status === "In Progress" || t.status === "Accepted").length
  const completedCount = tasks.filter(t => t.status === "Approved" || t.status === "Completed").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight">My Workspace</h2>
        <p className="text-muted-foreground">
          Welcome back, <strong>{user?.name}</strong>. Start timers on your assigned tasks, record log hours, and submit work reviews.
        </p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Assigned Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending start or execution</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Work Session</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activeSession ? formatTime(elapsedSeconds) : "Inactive"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {activeSession ? `${activeSession.task?.title}` : "No active work session"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Marked completed or approved</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Work Log Status</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Unfiled</div>
            <p className="text-xs text-muted-foreground mt-1">Daily productivity log pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
          <CardDescription>Tasks assigned by your manager</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Assigned By</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Status</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-center">Track Time</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No tasks assigned to you.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map(t => (
                    <TableRow
                      key={t._id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetailTask(t)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{t.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{t.category}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.assignedBy?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize">
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[t.status] || "default"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                        {activeSession && activeSession.task?._id === t._id ? (
                          <div className="flex items-center justify-center gap-1">
                            {isRunning ? (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-500 hover:text-yellow-600" onClick={pauseTimer}>
                                <Pause className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={resumeTimer}>
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={stopTimer}>
                              <Square className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          !["Completed", "Approved"].includes(t.status) && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={e => handlePlayRow(e, t._id)}>
                              <Play className="h-4 w-4" />
                            </Button>
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground/90">
                        {t.progressPercentage}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Task Detail Modal */}
      <Dialog open={detailTask !== null} onOpenChange={() => setDetailTask(null)}>
        {detailTask && (
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle>{detailTask.title}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[detailTask.status] || "default"}>
                  {detailTask.status}
                </Badge>
              </div>
              <DialogDescription>{detailTask.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Task Details Info */}
              <div className="grid grid-cols-2 gap-3 text-sm border-y border-border/40 py-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assigned By: <strong>{detailTask.assignedBy?.name}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Due: <strong>{detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString() : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Est. Hours: <strong>{detailTask.estimatedHours} hrs</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  <span>Progress: <strong>{detailTask.progressPercentage}%</strong></span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30">
                  {detailTask.description || "No description provided."}
                </p>
              </div>

              {/* Task Timer Panel */}
              {!["Completed", "Approved"].includes(detailTask.status) && (
                <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-card/60 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-primary" />
                      Task Time Tracking
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {activeSession && activeSession.task?._id === detailTask._id
                        ? "Currently tracking this task"
                        : "No active timer for this task"}
                    </p>
                  </div>
                  <div>
                    {activeSession && activeSession.task?._id === detailTask._id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-bold tracking-tight bg-muted px-2.5 py-1 rounded">
                          {formatTime(elapsedSeconds)}
                        </span>
                        {isRunning ? (
                          <Button size="sm" variant="outline" className="h-8 px-3" onClick={pauseTimer}>
                            <Pause className="h-3.5 w-3.5 mr-1" /> Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 px-3" onClick={resumeTimer}>
                            <Play className="h-3.5 w-3.5 mr-1" /> Resume
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="h-8 px-3" onClick={stopTimer}>
                          <Square className="h-3.5 w-3.5 mr-1" /> Stop
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => startTimer(detailTask._id)}>
                        <Play className="h-3.5 w-3.5 mr-1.5" /> Start Timer
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Employee Workflow Gating Panels */}
              {renderTransitionButtons(detailTask) && (
                <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-muted/20">
                  <h4 className="text-sm font-semibold text-foreground">Action Panel</h4>
                  <div className="space-y-2">
                    <Label htmlFor="trans-comm" className="text-xs">Transition Comments (optional)</Label>
                    <Input
                      id="trans-comm"
                      placeholder="Add an update comment regarding this status change..."
                      value={transitionComment}
                      onChange={e => setTransitionComment(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    {renderTransitionButtons(detailTask)}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({detailTask.comments.length})
                </h4>

                {/* Comment log stream */}
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {detailTask.comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No comments logged yet.</p>
                  ) : (
                    detailTask.comments.map(c => (
                      <div key={c._id} className="text-xs bg-muted/40 p-2.5 rounded-lg border border-border/30 space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground/90">{c.author?.name} ({c.author?.role})</span>
                          <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Post comment form */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <Input
                    placeholder="Write a message..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0">
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
