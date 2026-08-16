import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import PersonAvatar from "@/components/ui/person-avatar"
import { UserCog, AlertTriangle, Check, Clock, CalendarOff } from "lucide-react"
import { getEmployeeCapacity, CAPACITY_REASON_LABELS } from "../../lib/taskHelpers"
import { formatTrackedTime } from "../../lib/taskFormatters"
import useManagerDashboardStore from "../../store/useManagerDashboardStore"
import useCalendarStore from "../../store/useCalendarStore"

// Move a task to another team member. The whole point of this dialog is the capacity
// annotation on each candidate — a manager reassigning work is choosing precisely on
// "who has room", and that number already exists client-side (getEmployeeCapacity).
//
// Over-capacity candidates are flagged but never blocked (Locked Logic §6: flag,
// don't prevent) — the manager may have context the numbers don't.
//
// Keyed on task._id by the caller so selection state resets between tasks.
const ReassignDialog = ({ task, open, onOpenChange, onConfirm, submitting }) => {
  const employees = useManagerDashboardStore(s => s.employees)
  const tasks = useManagerDashboardStore(s => s.tasks)
  const calendar = useCalendarStore(s => s.calendar)
  const [selectedId, setSelectedId] = useState(null)

  if (!task) return null

  const currentAssigneeId = task.assignedTo?._id || task.assignedTo
  const day = task.dueDate ? new Date(task.dueDate) : new Date()
  const candidates = employees.filter(e => e.role === "employee")

  // What this task would add to whoever receives it.
  const taskHours = task.estimatedHours || 0

  const handleConfirm = async () => {
    if (!selectedId) return
    const result = await onConfirm(task, selectedId)
    if (result?.success) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserCog className="h-4.5 w-4.5 text-primary" />
            Reassign task
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">“{task.title}”</span>
            {taskHours > 0 && <> — {taskHours}h estimated</>}
            {task.dueDate && <>, due {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1 max-h-[320px] overflow-y-auto pr-1">
          <p className="text-[11px] text-muted-foreground font-medium">
            Remaining capacity shown for {task.dueDate ? "the task's due date" : "today"}, after this task is added.
          </p>

          {candidates.length === 0 && (
            <div className="text-xs text-muted-foreground text-center py-6">
              No team members available to reassign to.
            </div>
          )}

          {candidates.map(emp => {
            const isCurrent = emp._id === currentAssigneeId
            const isSelected = emp._id === selectedId
            // Preview the load this person would carry WITH the task added, so the
            // number answers "can they take it?" rather than "what do they have now?"
            const cap = getEmployeeCapacity(emp, tasks, isCurrent ? 0 : taskHours, day, calendar)

            return (
              <button
                key={emp._id}
                type="button"
                disabled={isCurrent || submitting}
                onClick={() => setSelectedId(emp._id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
                  isCurrent
                    ? "border-border/30 bg-muted/20 opacity-60 cursor-not-allowed"
                    : isSelected
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/40 hover:border-primary/30 hover:bg-muted/30"
                }`}
              >
                <PersonAvatar name={emp.name} seed={emp._id} fallback="EM" className="h-8 w-8 text-[10px] shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground/90 truncate">{emp.name}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold uppercase shrink-0">Current</Badge>
                    )}
                  </div>
                  <div className="text-[10px] font-medium mt-0.5">
                    {cap.capacityHours === 0 ? (
                      <span className="text-muted-foreground/80 flex items-center gap-1">
                        <CalendarOff className="h-2.5 w-2.5" />
                        {cap.holidayName || CAPACITY_REASON_LABELS[cap.capacityReason] || "Unavailable"} that day
                      </span>
                    ) : cap.isOverCapacity ? (
                      <span className="text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Would be over capacity — {cap.plannedHours}h planned vs {cap.capacityHours}h
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {cap.plannedHours}h planned of {cap.capacityHours}h · {Math.max(0, cap.remainingHours)}h free
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            )
          })}
        </div>

        {task.totalTrackedSeconds > 0 && (
          <p className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
            <Clock className="h-3 w-3 shrink-0" />
            {formatTrackedTime(task.totalTrackedSeconds)} already tracked stays with the task; any running timer is stopped.
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" className="rounded-lg h-9" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-lg h-9 font-semibold"
            onClick={handleConfirm}
            disabled={submitting || !selectedId}
          >
            {submitting ? "Reassigning…" : "Reassign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ReassignDialog
