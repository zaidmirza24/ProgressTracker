import { Card } from "@/components/ui/card"
import { AlertTriangle, CheckCircle2 } from "lucide-react"
import { isTaskOverdue } from "../../../lib/taskHelpers"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"

// Surfaces overdue/overrunning tasks explicitly at the top of the page instead of
// leaving them as a small badge a user has to scroll into the task list to spot.
// Purely a summary + scroll-link into "My Assigned Tasks" below — no new actions.
const scrollToTasks = () => {
  document.getElementById("my-tasks-section")?.scrollIntoView({ behavior: "smooth", block: "start" })
}

const NeedsAttentionStrip = () => {
  const tasks = useEmployeeDashboardStore(s => s.tasks)

  const overdueCount = tasks.filter(isTaskOverdue).length
  const overrunCount = tasks.filter(t => t.isOverrun && t.status !== "Completed").length

  if (overdueCount === 0 && overrunCount === 0) {
    return (
      <Card className="border-border/40 bg-card/30 flex items-center gap-2.5 px-4 py-3">
        <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
        <span className="text-sm text-muted-foreground font-medium">Nothing overdue or over estimate — you're on track.</span>
      </Card>
    )
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {overdueCount > 0 && (
        <button
          type="button"
          onClick={scrollToTasks}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-bold">{overdueCount}</span>
          <span className="text-xs font-medium">{overdueCount === 1 ? "task overdue" : "tasks overdue"}</span>
        </button>
      )}
      {overrunCount > 0 && (
        <button
          type="button"
          onClick={scrollToTasks}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning transition-colors text-left"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="text-sm font-bold">{overrunCount}</span>
          <span className="text-xs font-medium">{overrunCount === 1 ? "task over estimate" : "tasks over estimate"}</span>
        </button>
      )}
    </div>
  )
}

export default NeedsAttentionStrip
