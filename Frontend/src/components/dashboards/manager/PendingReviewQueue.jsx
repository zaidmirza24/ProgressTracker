import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserCheck, User } from "lucide-react"
import { formatTrackedTime, formatOverrun } from "../../../lib/taskFormatters"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// In-Review queue with inline approve/reject. `updateTaskStatus` and `submitting`
// come from the shared useTaskStatusMutation instance owned by the shell (also used
// by TeamTasksTable and TaskDetailModal), so an approve/reject here stays in sync
// everywhere. `setDetailTask` opens the shared Task Detail modal.
const PendingReviewQueue = ({ updateTaskStatus, submitting, setDetailTask }) => {
  const tasks = useManagerDashboardStore(s => s.tasks)
  const [inlineRejectId, setInlineRejectId] = useState(null)
  const [inlineRejectComment, setInlineRejectComment] = useState("")

  const handleInlineApprove = async (taskId) => {
    await updateTaskStatus(taskId, "Completed", "Approved by manager.")
  }

  const handleInlineReject = async (taskId) => {
    if (!inlineRejectComment.trim()) return
    const result = await updateTaskStatus(taskId, "In Progress", inlineRejectComment)
    if (result.success) {
      setInlineRejectId(null)
      setInlineRejectComment("")
    }
  }

  const reviewTasks = tasks.filter(t => t.status === "In Review")
  if (reviewTasks.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <UserCheck className="h-5 w-5 text-warning" />
        Pending Review Queue ({reviewTasks.length})
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        {reviewTasks.map(t => {
          const lastComment = t.comments && t.comments.length > 0 ? t.comments[t.comments.length - 1].text : "No notes provided."
          return (
            <Card key={t._id} className="border-warning/30 bg-card/45 backdrop-blur-sm shadow-md overflow-hidden relative border-l-4 border-l-warning">
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{t.category}</span>
                  <CardTitle className="text-sm font-bold text-foreground mt-0.5 leading-snug">{t.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                    <User className="h-3 w-3" /> Submitted by <strong className="text-foreground">{t.assignedTo?.name}</strong>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {t.totalTrackedSeconds > 0 && (
                    <Badge variant="outline" className="font-mono text-[10px] border-violet-500/20 text-violet-400">
                      {formatTrackedTime(t.totalTrackedSeconds)} tracked
                    </Badge>
                  )}
                  {formatOverrun(t) && (
                    <Badge variant="destructive" className="text-[10px] font-bold">
                      {formatOverrun(t)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-3">
                <div className="bg-muted/30 p-2.5 rounded-lg border border-border/20 text-xs text-muted-foreground italic">
                  "{lastComment}"
                </div>

                {inlineRejectId === t._id ? (
                  <div className="space-y-2">
                    <textarea
                      placeholder="Explain what needs rework before this can be sent back..."
                      value={inlineRejectComment}
                      onChange={e => setInlineRejectComment(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      rows={2}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => { setInlineRejectId(null); setInlineRejectComment(""); }}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs rounded-md font-semibold" onClick={() => handleInlineReject(t._id)} disabled={submitting || !inlineRejectComment.trim()}>
                        Send for Rework
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg text-muted-foreground hover:text-foreground" onClick={() => setDetailTask(t)}>
                      View Details
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => { setInlineRejectId(t._id); setInlineRejectComment(""); }}>
                      Rework
                    </Button>
                    <Button size="sm" className="h-8 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm" onClick={() => handleInlineApprove(t._id)} disabled={submitting}>
                      Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default PendingReviewQueue
