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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ClipboardList, CheckCircle2, Clock, Calendar,
  MessageSquare, Send, User, BarChart3,
  Play, Pause, Square, AlertCircle, ArrowUpRight
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
  
  // Forms
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

  const handleStatusTransition = async (newStatus) => {
    if (!detailTask) return
    setSubmitting(true)
    try {
      const res = await axios.put(`${API_BASE}/api/tasks/${detailTask._id}/status`, {
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

  // Helper to determine next transition options
  const renderTransitionButtons = (task) => {
    const btnStyle = "w-full sm:w-auto font-semibold shadow-sm"
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
  const activeCount = tasks.filter(t => ["In Progress", "Accepted"].includes(t.status)).length
  const completedCount = tasks.filter(t => ["Approved", "Completed"].includes(t.status)).length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          My Workspace
        </h2>
        <p className="text-muted-foreground">
          Welcome back, <strong className="text-foreground">{user?.name}</strong>. Start timers on your assigned tasks, record log hours, and submit work reviews.
        </p>
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
                  <TableHead className="font-semibold text-foreground/80">Status</TableHead>
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
                            Once your manager assigns a task to your name, it will show up here.
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map(t => {
                    const isTaskActive = activeSession && activeSession.task?._id === t._id
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
                            <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors">{t.title}</span>
                            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{t.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                              {t.assignedBy?.name ? t.assignedBy.name[0].toUpperCase() : "M"}
                            </div>
                            <span>{t.assignedBy?.name || "Manager"}</span>
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
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                            {t.status}
                          </Badge>
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

      {/* Task Detail Modal */}
      <Dialog open={detailTask !== null} onOpenChange={() => setDetailTask(null)}>
        {detailTask && (
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto border-border/60">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6 gap-4">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{detailTask.title}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[detailTask.status] || "default"} className="font-bold shrink-0">
                  {detailTask.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs uppercase tracking-wider font-semibold text-primary">{detailTask.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
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

              {/* Employee Workflow Gating Panels */}
              {renderTransitionButtons(detailTask) && (
                <div className="space-y-3.5 p-4 rounded-xl border border-border/40 bg-primary/[0.02]">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Workflow Transition</h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="trans-comm" className="text-xs text-muted-foreground">Transition Comments (optional)</Label>
                    <Input
                      id="trans-comm"
                      placeholder="e.g. Completed initial design, waiting for feedback..."
                      value={transitionComment}
                      onChange={e => setTransitionComment(e.target.value)}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    {renderTransitionButtons(detailTask)}
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
