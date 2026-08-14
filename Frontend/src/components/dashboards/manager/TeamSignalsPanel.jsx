import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown, ChevronRight, ClipboardList, Clock, Gauge,
  CheckCircle2, CalendarClock, ShieldCheck, TrendingDown, AlertTriangle
} from "lucide-react"
import { getInitials, formatHours, buildEmployeeSignalSummary } from "../../../lib/taskFormatters"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Iteration 11: wires every signal from Iterations 7-10 (overrun alerts, V1 capacity,
// split completion rates, pending-backlog age, estimation pattern) into one expandable
// per-employee summary, matching the doc's mental model: Task -> Time -> Capacity ->
// Completion -> Deadline -> Quality -> Pattern (Locked Logic §12).
const SignalBlock = ({ icon: Icon, label, flagged, children }) => (
  <div className={`rounded-lg border p-2.5 space-y-1 ${flagged ? "border-destructive/30 bg-destructive/5" : "border-border/30 bg-muted/10"}`}>
    <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3 w-3" /> {label}
    </div>
    <div className="space-y-0.5">{children}</div>
  </div>
)

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono font-bold text-foreground">{value}</span>
  </div>
)

const TeamSignalsPanel = () => {
  const employees = useManagerDashboardStore(s => s.employees).filter(emp => emp.role === "employee")
  const report = useManagerDashboardStore(s => s.report)
  const [expandedId, setExpandedId] = useState(null)

  if (!report || employees.length === 0) return null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Employee Signal Summary
        </h3>
        <p className="text-sm text-muted-foreground">Task, time, capacity, completion, deadline, quality, and pattern signals — expand a row for the full picture</p>
      </div>
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm divide-y divide-border/30 overflow-hidden">
        {employees.map(emp => {
          const r = report.employeeReport?.find(row => row._id === emp._id)
          if (!r) return null
          const isOpen = expandedId === emp._id
          const summary = buildEmployeeSignalSummary(r)

          return (
            <div key={emp._id}>
              <button
                type="button"
                onClick={() => setExpandedId(isOpen ? null : emp._id)}
                className="w-full flex flex-col gap-1.5 p-4 hover:bg-muted/20 transition-colors text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                      {getInitials(emp.name, "EM")}
                    </div>
                    <span className="font-bold text-sm text-foreground/90 truncate">{emp.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    {r.isCapacityOverrunToday && (
                      <Badge variant="destructive" className="text-[8px] py-0 px-1.5 font-bold uppercase">Over Capacity</Badge>
                    )}
                    {r.hasOverrunPattern && (
                      <Badge variant="destructive" className="text-[8px] py-0 px-1.5 font-bold uppercase gap-0.5">
                        <TrendingDown className="h-2.5 w-2.5" /> Pattern
                      </Badge>
                    )}
                    {r.overdue > 0 && (
                      <Badge variant="outline" className="text-[8px] py-0 px-1.5 font-bold uppercase border-amber-500/30 text-amber-400">
                        {r.overdue} Overdue
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Auto-generated plain-English one-liner, even while collapsed */}
                <p className={`text-[11px] pl-[2.375rem] truncate ${summary.hasWarning ? "text-amber-400 font-medium" : "text-muted-foreground"}`}>
                  {summary.headline}
                </p>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 animate-in fade-in duration-200">
                  <p className="text-xs text-muted-foreground leading-relaxed bg-muted/15 border border-border/30 rounded-lg p-3">
                    {summary.paragraph}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <SignalBlock icon={ClipboardList} label="Task">
                    <Row label="Total" value={r.total} />
                    <Row label="Completed" value={r.completed} />
                    <Row label="In Progress" value={r.inProgress} />
                  </SignalBlock>

                  <SignalBlock icon={Clock} label="Time">
                    <Row label="Tracked" value={formatHours(r.totalTrackedSeconds)} />
                    <Row label="Estimation Accuracy" value={`${r.estimationAccuracy}%`} />
                  </SignalBlock>

                  <SignalBlock icon={Gauge} label="Capacity Today" flagged={r.isCapacityOverrunToday}>
                    <Row label="Planned Util." value={`${r.plannedUtilizationPct}%`} />
                    <Row label="Actual Util." value={`${r.actualUtilizationPct}%`} />
                    {r.isCapacityOverrunToday && (
                      <span className="text-destructive font-bold">Over capacity today</span>
                    )}
                  </SignalBlock>

                  <SignalBlock icon={CheckCircle2} label="Completion">
                    <Row label="Daily" value={`${r.dailyCompletionRate}%`} />
                    <Row label="Assigned" value={`${r.assignedCompletionRate}%`} />
                    <Row label="Overall" value={`${r.overallCompletionRate}%`} />
                    <span className="text-muted-foreground text-[10px]">{r.dailyNewCount} new / {r.dailyCarriedForwardCount} carried</span>
                  </SignalBlock>

                  <SignalBlock icon={CalendarClock} label="Deadline" flagged={r.overdue > 0}>
                    <Row label="Overdue" value={r.overdue} />
                    <Row label="Pending Backlog" value={r.pending} />
                    <Row label="Avg Pending Age" value={`${r.pendingBacklogAvgAgeDays}d`} />
                  </SignalBlock>

                  <SignalBlock icon={ShieldCheck} label="Quality">
                    <Row label="Avg Resolution" value={`${r.avgResolutionDays}d`} />
                  </SignalBlock>

                  <SignalBlock icon={TrendingDown} label="Pattern" flagged={r.hasOverrunPattern}>
                    {r.recentEstimatedTasks?.length > 0 ? (
                      <>
                        <Row label="Recent Overrun" value={`${Math.round((r.recentOverrunProportion || 0) * 100)}%`} />
                        {r.hasOverrunPattern && (
                          <span className="text-destructive font-bold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Flagged
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted-foreground italic">Not enough completed+estimated tasks yet</span>
                    )}
                  </SignalBlock>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

export default TeamSignalsPanel
