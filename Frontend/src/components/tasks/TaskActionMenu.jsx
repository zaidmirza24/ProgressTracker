import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, CalendarPlus, UserCog, Ban, Eye, ShieldAlert, PlayCircle } from "lucide-react"

// One action menu, rendered wherever a task appears (table row, kanban card, workload
// card line, review queue card) so a problem can be acted on where it's discovered
// rather than only from the detail modal.
//
// Items are HIDDEN rather than disabled when unavailable — the server rejects them
// anyway, and a menu full of dead entries is noise. Callers pass only the handlers
// they support, so a surface without a reassign flow simply doesn't show that item.
//
// Every task row in this app already has a row-level onClick that opens the detail
// modal, so the trigger stops propagation.
const TaskActionMenu = ({
  task,
  onView,
  onEdit,
  onReassign,
  onMoveToTomorrow,
  onToggleBlocked,
  onCancel,
  disabled = false,
  className = ""
}) => {
  // Locked Logic §4 — a completed task's record is final; only viewing remains.
  const isLocked = task.status === "Completed"
  // Daily tasks are generated per employee from a template and can't move to someone else.
  const canReassign = Boolean(onReassign) && !task.isDaily && !isLocked

  const showEdit = Boolean(onEdit) && !isLocked
  const showMove = Boolean(onMoveToTomorrow) && !isLocked
  const showCancel = Boolean(onCancel) && !isLocked
  // Blocking from a row uses the task's existing reason when unblocking; blocking
  // itself needs a reason, so the row action opens the detail modal instead.
  const showBlock = Boolean(onToggleBlocked) && !isLocked
  const hasAnyAction = showEdit || canReassign || showMove || showBlock || showCancel

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${task.title}`}
          disabled={disabled}
          onClick={e => e.stopPropagation()}
          className={`h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-40 ${className}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={e => e.stopPropagation()}>
        {onView && (
          <DropdownMenuItem onSelect={() => onView(task)} className="gap-2 text-xs">
            <Eye className="h-3.5 w-3.5" /> View details
          </DropdownMenuItem>
        )}
        {onView && hasAnyAction && <DropdownMenuSeparator />}

        {showEdit && (
          <DropdownMenuItem onSelect={() => onEdit(task)} className="gap-2 text-xs">
            <Pencil className="h-3.5 w-3.5" /> Edit task
          </DropdownMenuItem>
        )}
        {canReassign && (
          <DropdownMenuItem onSelect={() => onReassign(task)} className="gap-2 text-xs">
            <UserCog className="h-3.5 w-3.5" /> Reassign…
          </DropdownMenuItem>
        )}
        {showMove && (
          <DropdownMenuItem onSelect={() => onMoveToTomorrow(task)} className="gap-2 text-xs">
            <CalendarPlus className="h-3.5 w-3.5" /> Move to tomorrow
          </DropdownMenuItem>
        )}

        {showBlock && (
          task.isBlocked ? (
            <DropdownMenuItem onSelect={() => onToggleBlocked(task, false)} className="gap-2 text-xs">
              <PlayCircle className="h-3.5 w-3.5" /> Unblock
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => onView?.(task)} className="gap-2 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" /> Mark blocked…
            </DropdownMenuItem>
          )
        )}

        {showCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => onCancel(task)}
              className="gap-2 text-xs text-destructive focus:text-destructive"
            >
              <Ban className="h-3.5 w-3.5" /> Cancel task
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default TaskActionMenu
