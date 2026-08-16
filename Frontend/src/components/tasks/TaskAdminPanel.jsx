import { Button } from "@/components/ui/button"
import { Pencil, Ban, Settings2 } from "lucide-react"

// Manager/admin task administration: edit (incl. reassign/reschedule) and cancel.
// Self-contained in the same way ApprovalGatingPanel is — it decides on its own
// whether there's anything to show, so the shell doesn't need to know the status rule.
//
// Completed tasks are locked (Locked Logic §4): their record is final, so neither
// action is offered. The server enforces the same rule with a 409.
const TaskAdminPanel = ({ detailTask, submitting, onEdit, onCancel }) => {
  if (!detailTask || detailTask.status === "Completed") return null

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-muted/10">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <Settings2 className="h-4 w-4 text-primary" />
        Manage Task
      </h4>
      <p className="text-xs text-muted-foreground">
        Change details, re-estimate, move the due date, reassign, or cancel this task.
      </p>
      <div className="flex gap-2 justify-end pt-0.5">
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg font-semibold gap-1.5 border-destructive/25 text-destructive hover:bg-destructive/10"
          onClick={() => onCancel(detailTask)}
          disabled={submitting}
        >
          <Ban className="h-3.5 w-3.5" />
          Cancel Task
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg font-semibold gap-1.5"
          onClick={() => onEdit(detailTask)}
          disabled={submitting}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit Task
        </Button>
      </div>
    </div>
  )
}

export default TaskAdminPanel
