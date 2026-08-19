import { useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Activity, ArrowUpRight, Briefcase, Clock, TrendingUp } from "lucide-react"
import { formatHours } from "../../../lib/taskFormatters"
import useReportsStore from "../../../store/useReportsStore"

// One-glance org pulse so a SuperAdmin doesn't have to open the Reports tab just to
// confirm nothing's on fire. Shares useReportsStore with the Reports tab, so the
// numbers here and there always agree — this triggers the initial fetch so the pulse
// is populated even if the Reports tab is never opened.
const OrgPulseStrip = ({ onViewReports }) => {
  const reports = useReportsStore(s => s.reports)
  const loading = useReportsStore(s => s.loading)
  const fetchReports = useReportsStore(s => s.fetchReports)

  useEffect(() => {
    if (!reports) fetchReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading && !reports) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    )
  }

  if (!reports) return null

  const { healthReport, departmentReport } = reports
  const topDepartments = [...departmentReport].sort((a, b) => b.total - a.total).slice(0, 4)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-primary" /> Organization Pulse
        </h3>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-semibold" onClick={onViewReports}>
          Full Reports <ArrowUpRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Briefcase className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight">{healthReport.totalTasks}</div>
            <div className="text-[11px] text-muted-foreground">Active tasks org-wide</div>
          </div>
        </Card>
        <Card className="border-border/50 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-4.5 w-4.5 text-green-500" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold tracking-tight text-green-400">{healthReport.avgCompletionRate}%</div>
            <div className="text-[11px] text-muted-foreground">Completion rate</div>
          </div>
        </Card>
        <Card className="border-border/50 p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
            <Clock className="h-4.5 w-4.5 text-violet-500" />
          </div>
          <div className="min-w-0">
            <div className="text-2xl font-bold font-mono tracking-tight text-violet-400">{formatHours(healthReport.totalTrackedSeconds)}</div>
            <div className="text-[11px] text-muted-foreground">Tracked time</div>
          </div>
        </Card>
      </div>

      {topDepartments.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {topDepartments.map(d => (
            <Card key={d.deptId} className="border-border/40 bg-card/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground/90 truncate">{d.name}</span>
                {d.overdue > 0 && (
                  <Badge variant="destructive" className="text-[8px] py-0 px-1 font-bold shrink-0">{d.overdue} late</Badge>
                )}
              </div>
              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: `${d.completionRate}%` }} />
              </div>
              <div className="text-[10px] text-muted-foreground">{d.completionRate}% complete · {d.total} tasks</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default OrgPulseStrip
