import { useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTimer } from "../context/TimerContext"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  TrendingUp, Repeat, Clock3, Gauge, TrendingDown, AlertTriangle,
  Briefcase, FileText, ArrowLeft, Play, CheckCircle2, RotateCcw, ShieldCheck
} from "lucide-react"
import { formatHours, formatTime, formatUtilization, formatQualityRate } from "../lib/taskFormatters"
import useEmployeeDashboardStore from "../store/useEmployeeDashboardStore"

// Dedicated deep-dive on the employee's own progress — the dashboard's "My Progress"
// card stays as a lightweight summary; this page is where the full breakdown lives.
// Two-column shell: detail content on the left, a persistent quick-stats rail on the
// right (today's tracked time, active session, capacity, and shortcuts).
const Stat = ({ label, value, sub }) => (
  <div className="bg-muted/20 border border-border/40 rounded-xl p-3.5 text-center space-y-1">
    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">{label}</div>
    <div className="text-xl font-black text-foreground">{value}</div>
    {sub && <div className="text-[9px] text-muted-foreground font-medium">{sub}</div>}
  </div>
)

const RateBlock = ({ label, value }) => (
  <div className="bg-muted/20 border border-border/40 rounded-xl p-3 space-y-1.5">
    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">{label}</div>
    <div className="text-base font-black text-foreground">{value}%</div>
    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
      <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
    </div>
  </div>
)

const MyProgress = () => {
  const { user } = useAuth()
  const { activeSession, elapsedSeconds } = useTimer()
  const report = useEmployeeDashboardStore(s => s.myReport)
  const reportError = useEmployeeDashboardStore(s => s.myReportError)
  const todayHours = useEmployeeDashboardStore(s => s.todayHours)
  const loadMyReport = useEmployeeDashboardStore(s => s.loadMyReport)

  useEffect(() => {
    loadMyReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (reportError && !report) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <div className="flex flex-col items-center gap-3 py-12 text-center px-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-semibold text-foreground">Couldn't load your progress</p>
            <p className="text-sm text-muted-foreground">Something went wrong fetching your data. Please try again.</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadMyReport} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!report) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <Link to="/employee" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
        </Link>
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" /> My Progress
        </h2>
        <p className="text-muted-foreground">
          All-time, personal only, <strong className="text-foreground">{user?.name}</strong> — for your eyes, never a scored ranking.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        {/* ─── Main content ─────────────────────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
              <Repeat className="h-4 w-4 text-primary" /> Completion Rates
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <RateBlock label="Daily" value={report.dailyCompletionRate ?? 0} />
              <RateBlock label="Assigned" value={report.assignedCompletionRate ?? 0} />
              <RateBlock label="Overall (derived)" value={report.overallCompletionRate ?? report.completionRate ?? 0} />
            </div>
            {(report.dailyNewCount > 0 || report.dailyCarriedForwardCount > 0) && (
              <p className="text-[11px] text-muted-foreground">
                Daily tasks: <strong className="text-foreground">{report.dailyNewCount ?? 0} new</strong>,{" "}
                <strong className="text-amber-400">{report.dailyCarriedForwardCount ?? 0} carried forward</strong> (not counted as new)
              </p>
            )}
          </Card>

          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
                <Gauge className="h-4 w-4 text-primary" /> Estimation &amp; Velocity
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Estimation Accuracy" value={`${report.estimationAccuracy ?? 100}%`} sub="Estimated vs tracked" />
                <Stat label="Avg. Resolution" value={`${report.avgResolutionDays ?? 0}d`} sub="Creation to completion" />
              </div>
            </Card>

            <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
                <Clock3 className="h-4 w-4 text-amber-400" /> Pending Backlog
              </h3>
              {report.pending > 0 ? (
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tasks Pending</span>
                    <span className="font-mono font-bold">{report.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Avg. Age</span>
                    <span className="font-mono font-bold">{report.blockedBacklogAvgAgeDays ?? 0}d</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Oldest</span>
                    <span className="font-mono font-bold">{report.pendingBacklogOldestAgeDays ?? 0}d</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-2">No pending backlog.</p>
              )}
            </Card>
          </div>

          {/* Quality — framed as information about the work, not a mark against the person */}
          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Review Quality
            </h3>
            {report.reviewedTaskCount > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/20 border border-border/40 rounded-xl p-3 text-center space-y-1">
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Approved First Time</div>
                    <div className="text-xl font-black text-foreground">{formatQualityRate(report.firstPassApprovalRate)}</div>
                  </div>
                  <div className="bg-muted/20 border border-border/40 rounded-xl p-3 text-center space-y-1">
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Reviewed Tasks</div>
                    <div className="text-xl font-black text-foreground">{report.reviewedTaskCount}</div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Work sent back often reflects unclear requirements as much as the work itself. If a task
                  came back, the manager's feedback is on the task itself.
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                None of your completed work has gone through manager review yet — daily and self-created
                tasks skip review by design, so there's no first-pass rate to show.
              </p>
            )}
          </Card>

          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
              <TrendingDown className={`h-4 w-4 ${report.hasOverrunPattern ? "text-destructive" : "text-primary"}`} />
              Estimation Pattern
            </h3>
            {report.recentEstimatedTasks?.length > 0 ? (
              <>
                {report.hasOverrunPattern ? (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/25 bg-destructive/5 text-xs">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-destructive">{Math.round((report.recentOverrunProportion ?? 0) * 100)}%</strong> of your last {report.recentEstimatedTasks.length} completed, estimated tasks ran over — worth a look at estimation or workload, not a mark against you.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No overrun pattern in your recent completed work.</p>
                )}
                <div className="space-y-1.5">
                  {report.recentEstimatedTasks.map(t => (
                    <div key={t._id} className="flex items-center justify-between gap-2 text-xs border border-border/30 rounded-lg px-2.5 py-1.5 bg-muted/10">
                      <span className="text-foreground/90 truncate">{t.title}</span>
                      <span className={`font-mono font-bold shrink-0 ${t.isOverrun ? "text-destructive" : "text-muted-foreground"}`}>
                        {t.trackedHours}h / {t.estimatedHours}h {t.isOverrun && `(+${t.overrunPercentage}%)`}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic">Not enough completed, estimated tasks yet to gauge a pattern.</p>
            )}
          </Card>

          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
              <Briefcase className="h-4 w-4 text-primary" /> Task Breakdown &amp; Tracked Time
            </h3>
            {!report.tasks || report.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No tasks logged yet.</p>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {report.tasks.map(t => {
                  const trackedHrs = ((t.totalTrackedSeconds || 0) / 3600).toFixed(1)
                  return (
                    <div key={t._id} className="border border-border/40 rounded-xl p-3 bg-muted/10 flex items-start justify-between gap-3 text-xs">
                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-foreground/95 flex items-center gap-2 truncate">
                          {t.title}
                          <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="text-[8px] py-0 px-1 font-bold tracking-wide uppercase shrink-0">
                            {t.priority}
                          </Badge>
                        </div>
                        <div className="text-[9px] text-muted-foreground/80 font-medium">
                          Created: {new Date(t.createdAt).toLocaleDateString()}
                          {t.dueDate && ` • Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <Badge className="font-bold uppercase tracking-wider text-[8px] scale-90 origin-right">{t.status}</Badge>
                        <div className="font-mono text-[10px] text-muted-foreground font-bold">
                          Tracked: <span className="text-violet-400">{trackedHrs}h</span> / {t.estimatedHours}h
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ─── Right rail: quick stats + shortcuts ──────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3">
            <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Right Now</h3>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5" /> Active session
                </span>
                <span className="font-mono font-bold">{activeSession ? formatTime(elapsedSeconds) : "—"}</span>
              </div>
              {activeSession && (
                <p className="text-[10px] text-muted-foreground truncate">{activeSession.task?.title}</p>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" /> Today's tracked time
                </span>
                <span className="font-mono font-bold">{todayHours}h</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> Tracked, all-time
                </span>
                <span className="font-mono font-bold">{formatHours(report.totalTrackedSeconds)}</span>
              </div>
            </div>
          </Card>

          <Card className={`border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-3 ${report.isCapacityOverrunToday ? "border-destructive/30" : ""}`}>
            <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
              <Gauge className={`h-3.5 w-3.5 ${report.isCapacityOverrunToday ? "text-destructive" : "text-primary"}`} />
              Today's Capacity
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Planned Utilization</span>
                <span className="font-mono font-bold">{formatUtilization(report.plannedUtilizationPct)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Actual Utilization</span>
                <span className="font-mono font-bold">{formatUtilization(report.actualUtilizationPct)}</span>
              </div>
              {report.isCapacityOverrunToday ? (
                <Badge variant="destructive" className="text-[9px] font-bold uppercase">Over Capacity Today</Badge>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-green-500 font-semibold">
                  <CheckCircle2 className="h-3 w-3" /> Within capacity
                </span>
              )}
            </div>
          </Card>

          <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm p-4 space-y-2">
            <h3 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Shortcuts</h3>
            <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg">
              <Link to="/work-logs"><FileText className="h-3.5 w-3.5" /> Submit work log</Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2 rounded-lg">
              <Link to="/employee"><ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard</Link>
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default MyProgress
