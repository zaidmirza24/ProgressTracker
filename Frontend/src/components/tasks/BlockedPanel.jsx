import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Ban, ShieldAlert, PlayCircle } from "lucide-react"

// "I'm stuck" — the one thing the person doing the work always knows first, and which
// the app previously had no way to say. Shown to the assignee and to managers alike.
//
// Blocked is deliberately independent of status: a task can be Not Started, In Progress,
// Pending or In Review and still be blocked. Pausing a timer is NOT blocking — that
// distinction is the whole point of this panel (a paused task is just a timer that's
// off; a blocked task is work that cannot proceed).
//
// Self-gating like the other action panels — the shell doesn't decide when to show it.
const BlockedPanel = ({ detailTask, submitting, onToggleBlocked }) => {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState("")

  if (!detailTask || !onToggleBlocked) return null
  // Completed work can't be blocked — there's nothing left to proceed with.
  if (detailTask.status === "Completed") return null

  const handleBlock = async () => {
    if (!reason.trim()) return
    const result = await onToggleBlocked(detailTask, true, reason.trim())
    if (result?.success) {
      setReason("")
      setShowForm(false)
    }
  }

  const handleUnblock = async () => {
    await onToggleBlocked(detailTask, false)
  }

  if (detailTask.isBlocked) {
    const since = detailTask.blockedAt ? new Date(detailTask.blockedAt) : null
    return (
      <div className="space-y-3 p-4 rounded-xl border border-destructive/40 bg-destructive/5">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          Blocked
        </h4>
        <p className="text-sm text-foreground/90 bg-background/40 border border-border/30 rounded-lg p-2.5 leading-relaxed">
          “{detailTask.blockedReason || "No reason recorded."}”
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-muted-foreground">
            {since
              ? `Blocked since ${since.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${since.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : "Blocked"}
            {detailTask.blockedBy?.name && ` · flagged by ${detailTask.blockedBy.name}`}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg font-semibold gap-1.5 shrink-0"
            onClick={handleUnblock}
            disabled={submitting}
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Unblock
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Starting the timer on this task unblocks it automatically.
        </p>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/10">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground/90">Waiting on something?</p>
          <p className="text-[11px] text-muted-foreground">
            Flag it as blocked so it shows up as stuck rather than just paused.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg font-semibold gap-1.5 shrink-0 border-destructive/25 text-destructive hover:bg-destructive/10"
          onClick={() => setShowForm(true)}
          disabled={submitting}
        >
          <Ban className="h-3.5 w-3.5" />
          Mark blocked
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <Ban className="h-4 w-4 text-destructive" />
        What's blocking this?
      </h4>
      <div className="space-y-1.5">
        <Label htmlFor="blocked-reason" className="text-xs text-muted-foreground">
          Reason (required)
        </Label>
        <Input
          id="blocked-reason"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Waiting on API credentials from IT"
          maxLength={300}
          className="h-9 rounded-lg"
          autoFocus
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="rounded-lg"
          onClick={() => { setShowForm(false); setReason("") }}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="rounded-lg font-semibold"
          onClick={handleBlock}
          disabled={submitting || !reason.trim()}
        >
          Mark blocked
        </Button>
      </div>
    </div>
  )
}

export default BlockedPanel
