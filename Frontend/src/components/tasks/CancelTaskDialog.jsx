import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Clock } from "lucide-react"
import { formatTrackedTime } from "../../lib/taskFormatters"

// Confirmation for a destructive action (§18). Uses the app's Dialog rather than a
// native confirm(), matching every other dialog in the product.
//
// Cancelling is a soft-delete: the task leaves every list and metric, but the record,
// its work sessions, and its audit trail are all retained server-side.
//
// The caller keys this component on the target task's id, so it remounts (and `reason`
// resets) whenever a different task is opened — no reset effect needed, and a reason
// typed for one task can never be submitted against another.
const CancelTaskDialog = ({ task, open, onOpenChange, onConfirm, submitting }) => {
  const [reason, setReason] = useState("")

  if (!task) return null

  const hasTrackedTime = task.totalTrackedSeconds > 0
  const isInFlight = ["In Progress", "Pending", "In Review"].includes(task.status)

  const handleConfirm = async () => {
    if (!reason.trim()) return
    const result = await onConfirm(task._id, reason.trim())
    if (result?.success) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
            Cancel this task?
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">“{task.title}”</span>
            {task.assignedTo?.name && <> — assigned to {task.assignedTo.name}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="text-xs text-muted-foreground bg-muted/20 border border-border/30 rounded-lg p-3 space-y-1.5">
            <p>
              The task will be removed from all task lists, workload, and reports. Its record,
              time logs, and history are kept and can be restored by an administrator.
            </p>
            {hasTrackedTime && (
              <p className="flex items-center gap-1.5 text-amber-400 font-medium">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {formatTrackedTime(task.totalTrackedSeconds)} of tracked time is logged against it.
              </p>
            )}
            {isInFlight && (
              <p className="flex items-center gap-1.5 text-amber-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                This task is currently {task.status.toLowerCase()} — any running timer will be stopped.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason" className="text-foreground/80 font-medium text-xs">
              Reason for cancelling <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Duplicate of an existing ticket, or no longer required this sprint"
              className="rounded-lg text-sm"
              rows={2}
              maxLength={300}
            />
            <p className="text-[10px] text-muted-foreground">
              Recorded in the task's audit history. {300 - reason.length} characters left.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" className="rounded-lg h-9" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep Task
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-lg h-9 font-semibold"
            onClick={handleConfirm}
            disabled={submitting || !reason.trim()}
          >
            {submitting ? "Cancelling…" : "Cancel Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CancelTaskDialog
