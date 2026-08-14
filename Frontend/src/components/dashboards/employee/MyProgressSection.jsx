import { Link } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, Clock3, Gauge, TrendingDown, ArrowUpRight } from "lucide-react"
import { formatHours } from "../../../lib/taskFormatters"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"

// Personal history/performance, scoped to the logged-in employee only (backend
// enforces this — /api/tasks/report returns just this employee's own row for an
// employee caller). Reuses the same signals managers already see, kept separate
// and non-punitive, matching how they're framed everywhere else in the app.
const Stat = ({ label, value, sub }) => (
  <div className="bg-muted/20 border border-border/40 rounded-xl p-3 text-center space-y-0.5">
    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">{label}</div>
    <div className="text-lg font-black text-foreground">{value}</div>
    {sub && <div className="text-[9px] text-muted-foreground font-medium">{sub}</div>}
  </div>
)

const MyProgressSection = () => {
  const report = useEmployeeDashboardStore(s => s.myReport)

  if (!report) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            My Progress
          </h3>
          <p className="text-sm text-muted-foreground">All-time, personal only — for your eyes, never a scored ranking</p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs font-semibold shrink-0">
          <Link to="/my-progress">
            View Full Breakdown <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Daily Completion" value={`${report.dailyCompletionRate ?? 0}%`} />
          <Stat label="Assigned Completion" value={`${report.assignedCompletionRate ?? 0}%`} />
          <Stat label="Estimation Accuracy" value={`${report.estimationAccuracy ?? 100}%`} sub="Estimated vs tracked" />
          <Stat label="Avg. Resolution" value={`${report.avgResolutionDays ?? 0}d`} sub="Creation to completion" />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30">
          {report.pending > 0 && (
            <Badge variant="outline" className="text-[10px] font-semibold gap-1.5 border-amber-500/30 text-amber-400">
              <Clock3 className="h-3 w-3" />
              {report.pending} pending · avg {report.pendingBacklogAvgAgeDays ?? 0}d old
            </Badge>
          )}
          {report.isCapacityOverrunToday && (
            <Badge variant="outline" className="text-[10px] font-semibold gap-1.5 border-destructive/30 text-destructive">
              <Gauge className="h-3 w-3" />
              Over capacity today
            </Badge>
          )}
          {report.hasOverrunPattern && (
            <Badge variant="outline" className="text-[10px] font-semibold gap-1.5 border-amber-500/30 text-amber-400">
              <TrendingDown className="h-3 w-3" />
              {Math.round((report.recentOverrunProportion ?? 0) * 100)}% of recent estimated tasks ran over — worth a look, not a mark against you
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {formatHours(report.totalTrackedSeconds)} tracked, all-time
          </span>
        </div>
      </Card>
    </div>
  )
}

export default MyProgressSection
