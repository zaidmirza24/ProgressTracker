import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, AlertTriangle, Activity, Award } from "lucide-react"
import useReportsStore from "../../../../store/useReportsStore"

const InsightsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { healthReport, employeeReport, priorityReport } = reports

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Insight Card: Alert Center */}
      <Card className="border-border/50 bg-background/25 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-amber-400" /> Organizational Risks & Bottlenecks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthReport.overdueTasks > 0 ? (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/25 bg-amber-500/5">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h5 className="font-bold text-amber-400">Overdue Task Alert</h5>
                <p className="text-muted-foreground leading-relaxed">
                  There are currently <strong className="text-foreground">{healthReport.overdueTasks} overdue tasks</strong>. Review the employee dashboard summary to re-evaluate priorities.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-green-500/25 bg-green-500/5 text-center text-xs text-green-400 font-bold">
              ✓ No overdue items identified across the organization.
            </div>
          )}

          {employeeReport.filter(e => e.total > 0 && e.completionRate < 30).length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/25 bg-destructive/5">
              <Activity className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <h5 className="font-bold text-destructive">Completion Bottlenecks</h5>
                <p className="text-muted-foreground leading-relaxed">
                  Certain employees have completion rates under 30% on active work items. Review resource allocation or blocker comments.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insight Card: Task Priority Distribution */}
      <Card className="border-border/50 bg-background/25 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Award className="h-4 w-4 text-violet-400" /> Work Load Priority Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3.5">
            {priorityReport.map(pr => {
              const percentage = healthReport.totalTasks > 0 ? Math.round((pr.total / healthReport.totalTasks) * 100) : 0
              const barColors = { high: "bg-destructive", medium: "bg-primary", low: "bg-secondary" }
              return (
                <div key={pr.priority} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="capitalize">{pr.priority} Priority</span>
                    <span>{pr.total} tasks ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div className={`${barColors[pr.priority]} h-full rounded-full`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default InsightsReport
