import { useState } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { useTimer } from "../../context/TimerContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Clock, Calendar, User, UserCheck, BarChart3, Send, Check, Play, Pause, Square, Loader2 } from "lucide-react"
import { STATUS_VARIANTS } from "../../lib/taskConstants"
import { formatTrackedTime, formatTime, formatOverrun, getInitials } from "../../lib/taskFormatters"
import { getStepperSteps, normalizeForStepper } from "../../lib/stepper"

// Shared Task Detail dialog for both Manager and Employee dashboards, unified from two
// previously-separate-but-identical-in-spirit implementations
// (components/dashboards/manager/TaskDetailModal.jsx and
// components/dashboards/employee/TaskDetailModal.jsx). Behavior is parameterized purely
// by the `role` prop — no business logic changed during the merge.
//
// Props:
//   Shared (both roles):
//     detailTask, setDetailTask   — the task being viewed / dialog open-state
//     submitting                  — disables in-flight action buttons
//     onCommentPosted             — async callback invoked after a comment posts
//                                    successfully, so the shell can reload its own
//                                    store (manager: loadData(managerId), employee:
//                                    loadTasks()) without this component importing
//                                    either dashboard store directly.
//     role                        — "manager" | "employee"
//   Manager-only:
//     updateTaskStatus            — (taskId, status, comment) => Promise<{success}>,
//                                    from useTaskStatusMutation in ManagerDashboard.
//                                    Used internally to implement the Approval Gating
//                                    Controls' handleReview, exactly as the old
//                                    manager-only file did.
//   Employee-only:
//     handleStatusTransition      — (newStatus, taskId=null) => Promise, from
//                                    EmployeeDashboard. Wired directly as the
//                                    clickable stepper's onClick.
const TaskDetailModal = ({
  role,
  detailTask,
  setDetailTask,
  submitting,
  onCommentPosted,
  updateTaskStatus,
  handleStatusTransition
}) => {
  const { activeSession, elapsedSeconds, isRunning, isPending, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()

  const [reviewComment, setReviewComment] = useState("")
  const [newComment, setNewComment] = useState("")

  // Manager-only: status is "Completed" (approve) or "In Progress" (send back for rework)
  const handleReview = async (status, feedbackOverride = "") => {
    if (!detailTask) return
    const result = await updateTaskStatus(detailTask._id, status, feedbackOverride || reviewComment)
    if (result.success) {
      setReviewComment("")
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
      if (typeof onCommentPosted === "function") {
        await onCommentPosted()
      }
    } catch (err) {
      console.error("Error adding comment:", err)
    }
  }

  return (
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

          <div className="space-y-6 py-2">
            {/* VISUAL WORKFLOW STEPPER */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workflow Timeline</h4>
              <div className="flex items-center justify-between relative px-2 py-4 bg-muted/20 border border-border/30 rounded-xl overflow-x-auto">
                {getStepperSteps(detailTask).map((step, idx, arr) => {
                  // Determine status active / completed status (Pending renders on the In Progress step)
                  const currentIdx = arr.findIndex(s => s.key === normalizeForStepper(detailTask.status))
                  const isCompleted = idx < currentIdx || detailTask.status === "Completed"
                  const isActive = idx === currentIdx && detailTask.status !== "Completed"
                  const isClickable = role === "employee" && idx === currentIdx + 1 && detailTask.status !== "Completed" && detailTask.status !== "Pending"

                  const circleClassName = `h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isCompleted
                      ? "bg-green-500 text-white shadow-sm border border-green-600"
                      : isActive
                        ? "bg-primary text-primary-foreground font-extrabold ring-4 ring-primary/20 scale-110"
                        : isClickable
                          ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 cursor-pointer animate-pulse"
                          : "bg-muted/80 text-muted-foreground border border-border"
                  }`

                  return (
                    <div key={step.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5 relative z-10">
                        {role === "employee" ? (
                          <button
                            type="button"
                            disabled={!isClickable || submitting}
                            onClick={() => handleStatusTransition(step.key)}
                            className={circleClassName}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </button>
                        ) : (
                          <div className={circleClassName}>
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </div>
                        )}
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
                {role === "manager" ? (
                  <span>Assigned To: <strong className="text-foreground">{detailTask.assignedTo?.name || "—"}</strong></span>
                ) : (
                  <span>Assigned By: <strong className="text-foreground">{detailTask.assignedBy?.name || "Manager"}</strong></span>
                )}
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
                <Clock className="h-4 w-4 text-violet-400" />
                <span>Time Tracked: <strong className="text-violet-400">{formatTrackedTime(detailTask.totalTrackedSeconds)}</strong></span>
              </div>
              <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Progress: <strong className="text-foreground">{detailTask.progressPercentage}%</strong></span>
              </div>
              {formatOverrun(detailTask) && (
                <div className="col-span-2 flex items-center gap-2">
                  <Badge variant="destructive" className="font-bold text-[11px]">
                    ⚠ {formatOverrun(detailTask)}
                  </Badge>
                  <span className="text-muted-foreground">Actual time has exceeded the estimate.</span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</h4>
              <p className="text-sm text-foreground bg-muted/20 p-3 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed">
                {detailTask.description || "No description provided."}
              </p>
            </div>

            {/* Approval Gating Controls (Manager only) — only while the task is actually In Review; Completed is locked */}
            {role === "manager" && detailTask.status === "In Review" && (
              <div className="space-y-3.5 p-4 rounded-xl border border-warning/30 bg-warning/5">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-warning" />
                  Work Awaiting Review
                </h4>
                <div className="space-y-1.5">
                  <Label htmlFor="review-comm" className="text-xs text-muted-foreground">Review Feedback Comments (required)</Label>
                  <Input
                    id="review-comm"
                    placeholder="Add design review notes, request fixes, or log acceptance..."
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    className="h-9 rounded-lg"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-lg font-semibold"
                    onClick={() => handleReview("In Progress")}
                    disabled={submitting || !reviewComment.trim()}
                  >
                    Send for Rework
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-lg font-semibold shadow"
                    onClick={() => handleReview("Completed")}
                    disabled={submitting || !reviewComment.trim()}
                  >
                    Approve Work
                  </Button>
                </div>
              </div>
            )}

            {/* Task Timer Panel (Employee only) */}
            {role === "employee" && !["Completed", "In Review"].includes(detailTask.status) && (
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
                        <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={pauseTimer} disabled={isPending}>
                          {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Pause className="h-3.5 w-3.5 mr-1" />} Pause
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={resumeTimer} disabled={isPending}>
                          {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1 text-primary" />} Resume
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={stopTimer} disabled={isPending}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1" />} Stop
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" className="rounded-lg shadow font-semibold disabled:opacity-60" onClick={() => startTimer(detailTask._id)} disabled={isPending}>
                      {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Start Timer
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Activity & Workflow History Tabs */}
            <div className="pt-2">
              <Tabs defaultValue="comments" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-xl h-9 mb-4">
                  <TabsTrigger value="comments" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground">
                    Discussion ({detailTask.comments?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground">
                    Workflow Audit Log ({detailTask.history?.length || 0})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="space-y-3 mt-0 focus-visible:outline-none">
                  {/* Comment log stream */}
                  <ScrollArea className="h-[180px] border border-border/40 rounded-xl bg-muted/10 p-3">
                    {detailTask.comments.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-8">
                        <p className="text-xs text-muted-foreground italic">No activities logged yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detailTask.comments.map(c => {
                          const authorInitials = getInitials(c.author?.name, "US")
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
                </TabsContent>

                <TabsContent value="history" className="space-y-3 mt-0 focus-visible:outline-none">
                  {/* History log stream */}
                  <ScrollArea className="h-[220px] border border-border/40 rounded-xl bg-muted/10 p-3">
                    {!detailTask.history || detailTask.history.length === 0 ? (
                      <div className="h-full flex items-center justify-center py-8">
                        <p className="text-xs text-muted-foreground italic">No state changes logged yet.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 pl-3 relative border-l border-border/60 ml-2.5 my-2">
                        {detailTask.history.map((h, i) => {
                          return (
                            <div key={h._id || i} className="relative text-xs space-y-1">
                              {/* Connector dot */}
                              <div className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background ring-4 ring-primary/10" />

                              <div className="flex justify-between items-center pl-1">
                                <span className="font-bold text-foreground/80">
                                  {h.changedBy?.name || "System"}
                                  <span className="text-[10px] text-muted-foreground font-normal"> ({h.changedBy?.role || "System"})</span>
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>

                              <div className="bg-card/50 p-2.5 rounded-lg border border-border/20 pl-4 ml-1 space-y-1.5 shadow-sm">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-muted-foreground bg-muted/40 py-0.5 px-1.5 rounded text-[9px] uppercase tracking-wider">{h.fromStatus}</span>
                                  <span className="text-muted-foreground/50 text-[10px]">➔</span>
                                  <span className="font-bold text-primary bg-primary/10 py-0.5 px-1.5 rounded text-[9px] uppercase tracking-wider">{h.toStatus}</span>
                                </div>
                                {h.comment && (
                                  <p className="text-muted-foreground italic pl-1.5 text-[11px] border-l-2 border-primary/20 leading-relaxed">
                                    "{h.comment}"
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}

export default TaskDetailModal
