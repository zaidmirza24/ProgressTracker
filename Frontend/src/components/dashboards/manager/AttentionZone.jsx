import { Card } from "@/components/ui/card"
import { useNavigate } from "react-router-dom"
import { UserCheck, Gauge, TrendingDown, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react"
import { isTaskOverdue, getEmployeeCapacity } from "../../../lib/taskHelpers"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Live, always-current summary of everything on the Manager dashboard that needs a
// decision right now. Reads the same store data PendingReviewQueue, TeamWorkloadTracker,
// and TeamSignalsPanel already use below it — this doesn't replace those sections, it
// just answers "who or what needs my attention?" in one glance and links down to them
// (or, for the Team Tasks Tracker which lives on its own page, navigates there),
// with a real empty state instead of disappearing when there's nothing to flag.
const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

const AttentionItem = ({ icon: Icon, count, label, targetId, to, tone = "warning" }) => {
  const navigate = useNavigate()
  if (count === 0) return null
  const toneClasses = {
    warning: "border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning",
    destructive: "border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive"
  }
  return (
    <button
      type="button"
      onClick={() => to ? navigate(to) : scrollToSection(targetId)}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border transition-colors text-left ${toneClasses[tone]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm font-bold">{count}</span>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

const AttentionZone = () => {
  const tasks = useManagerDashboardStore(s => s.tasks)
  const employees = useManagerDashboardStore(s => s.employees)
  const report = useManagerDashboardStore(s => s.report)

  const reviewCount = tasks.filter(t => t.status === "In Review").length
  const overdueCount = tasks.filter(isTaskOverdue).length
  // Blocked work is usually the fastest thing a manager can actually fix.
  const blockedCount = tasks.filter(t => t.isBlocked && t.status !== "Completed").length
  const overCapacityCount = employees.filter(emp => getEmployeeCapacity(emp, tasks).isOverCapacity).length
  const patternCount = report?.employeeReport?.filter(r => r.hasOverrunPattern).length ?? 0

  const totalFlags = reviewCount + overdueCount + blockedCount + overCapacityCount + patternCount

  return (
    <div className="space-y-3">
      <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-warning" />
        Needs Your Attention
      </h3>
      {totalFlags === 0 ? (
        <Card className="border-border/40 bg-card/30 flex items-center gap-2.5 px-4 py-3.5">
          <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
          <span className="text-sm text-muted-foreground font-medium">Nothing needs your attention right now.</span>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2.5">
          <AttentionItem
            icon={UserCheck}
            count={reviewCount}
            label={reviewCount === 1 ? "task waiting for review" : "tasks waiting for review"}
            targetId="pending-review-section"
            tone="warning"
          />
          <AttentionItem
            icon={ShieldAlert}
            count={blockedCount}
            label={blockedCount === 1 ? "task blocked" : "tasks blocked"}
            to="/team-tasks?filter=blocked"
            tone="destructive"
          />
          <AttentionItem
            icon={AlertTriangle}
            count={overdueCount}
            label={overdueCount === 1 ? "task overdue" : "tasks overdue"}
            to="/team-tasks?filter=overdue"
            tone="destructive"
          />
          <AttentionItem
            icon={Gauge}
            count={overCapacityCount}
            label={overCapacityCount === 1 ? "team member over capacity today" : "team members over capacity today"}
            targetId="team-workload-section"
            tone="destructive"
          />
          <AttentionItem
            icon={TrendingDown}
            count={patternCount}
            label={patternCount === 1 ? "team member flagged for estimation pattern" : "team members flagged for estimation pattern"}
            targetId="team-signals-section"
            tone="warning"
          />
        </div>
      )}
    </div>
  )
}

export default AttentionZone
