import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatUtilization, formatQualityRate } from "../../../../lib/taskFormatters"
import { Badge } from "@/components/ui/badge"
import { Briefcase, User, AlertTriangle, Repeat, Clock3, TrendingDown, ShieldCheck } from "lucide-react"
import useReportsStore from "../../../../store/useReportsStore"

const EmployeeDrilldownModal = () => {
  const selectedEmployee = useReportsStore(s => s.selectedEmployee)
  const setSelectedEmployee = useReportsStore(s => s.setSelectedEmployee)

  return (
    <Dialog open={selectedEmployee !== null} onOpenChange={() => setSelectedEmployee(null)}>
      {selectedEmployee && (
        <DialogContent className="max-w-2xl bg-card/95 backdrop-blur shadow-2xl border-border/50 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Employee Performance Detail: {selectedEmployee.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-muted-foreground">
              {selectedEmployee.email} • {selectedEmployee.department} — {selectedEmployee.team}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Detailed Performance Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Tasks Completed</div>
                <div className="text-xl font-black text-green-400 mt-1">
                  {selectedEmployee.completed ?? 0} / {selectedEmployee.total ?? 0}
                </div>
                <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">({selectedEmployee.completionRate ?? 0}% Rate)</div>
              </div>

              <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Avg. Resolution Velocity</div>
                <div className="text-xl font-black text-primary mt-1">
                  {selectedEmployee.avgResolutionDays ?? 0} Days
                </div>
                <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">From creation to completion</div>
              </div>

              <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Estimation Accuracy</div>
                <div className="text-xl font-black text-violet-400 mt-1">
                  {selectedEmployee.estimationAccuracy ?? 100}%
                </div>
                <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">Estimated vs Tracked Hours</div>
              </div>
            </div>

            {/* Productivity Signals (Locked Logic §7/§8/§11 — separate signals, never a
                combined score). Daily/Assigned tracked apart from the derived Overall rate. */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                <Repeat className="h-4 w-4 text-primary" /> Completion Rates
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Daily", value: selectedEmployee.dailyCompletionRate ?? 0 },
                  { label: "Assigned", value: selectedEmployee.assignedCompletionRate ?? 0 },
                  { label: "Overall (derived)", value: selectedEmployee.overallCompletionRate ?? selectedEmployee.completionRate ?? 0 }
                ].map(m => (
                  <div key={m.label} className="bg-muted/20 border border-border/40 rounded-xl p-2.5 space-y-1.5">
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">{m.label}</div>
                    <div className="text-base font-black text-foreground">{m.value}%</div>
                    <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${m.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {(selectedEmployee.dailyNewCount > 0 || selectedEmployee.dailyCarriedForwardCount > 0) && (
                <p className="text-[11px] text-muted-foreground">
                  Daily tasks: <strong className="text-foreground">{selectedEmployee.dailyNewCount ?? 0} new</strong>,{" "}
                  <strong className="text-amber-400">{selectedEmployee.dailyCarriedForwardCount ?? 0} carried forward</strong> (not counted as new)
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Today's Capacity Utilization — Planned vs Actual are separate metrics (§7) */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                  <AlertTriangle className={`h-4 w-4 ${selectedEmployee.isCapacityOverrunToday ? "text-destructive" : "text-primary"}`} />
                  Today's Capacity
                </h4>
                <p className="text-[9px] text-muted-foreground/80 -mt-1">Always as of today, independent of the report range above.</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Planned Utilization</span>
                    <span className="font-mono font-bold">{formatUtilization(selectedEmployee.plannedUtilizationPct)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Actual Utilization</span>
                    <span className="font-mono font-bold">{formatUtilization(selectedEmployee.actualUtilizationPct)}</span>
                  </div>
                  {selectedEmployee.isCapacityOverrunToday && (
                    <Badge variant="destructive" className="text-[9px] font-bold uppercase">Over Capacity Today</Badge>
                  )}
                </div>
              </div>

              {/* Pending Backlog Age */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                  <Clock3 className="h-4 w-4 text-amber-400" /> Pending Backlog
                </h4>
                {selectedEmployee.pending > 0 ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tasks Pending</span>
                      <span className="font-mono font-bold">{selectedEmployee.pending}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Avg. Age</span>
                      <span className="font-mono font-bold">{selectedEmployee.blockedBacklogAvgAgeDays ?? 0}d</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Oldest</span>
                      <span className="font-mono font-bold">{selectedEmployee.pendingBacklogOldestAgeDays ?? 0}d</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No pending backlog.</p>
                )}
              </div>
            </div>

            {/* Quality / Rework (Locked Logic §9) — approved-first-time vs sent back,
                always traceable to the specific tasks and the feedback given. */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                <ShieldCheck className={`h-4 w-4 ${selectedEmployee.hasQualitySignal ? "text-amber-400" : "text-primary"}`} />
                Quality & Rework
              </h4>

              {selectedEmployee.reviewedTaskCount > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/20 border border-border/40 rounded-xl p-3 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">First-pass Approval</div>
                      <div className="text-lg font-black text-foreground">{formatQualityRate(selectedEmployee.firstPassApprovalRate)}</div>
                      <div className="text-[9px] text-muted-foreground">
                        of {selectedEmployee.reviewedTaskCount} reviewed task{selectedEmployee.reviewedTaskCount === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="bg-muted/20 border border-border/40 rounded-xl p-3 space-y-1">
                      <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wide">Rework Rate</div>
                      <div className="text-lg font-black text-foreground">{formatQualityRate(selectedEmployee.reworkRate)}</div>
                      <div className="text-[9px] text-muted-foreground">sent back at least once</div>
                    </div>
                  </div>
                  {selectedEmployee.hasQualitySignal && (
                    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/5 text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">
                        Most reviewed work is coming back at least once. That often points at unclear
                        requirements or acceptance criteria as much as at the work itself — the tasks below
                        show what was actually asked for.
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  No completed work has gone through review yet, so there's no first-pass rate to report.
                  Daily and self-assigned tasks skip review by design.
                </p>
              )}

              {selectedEmployee.reworkedTasks?.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Tasks sent back</div>
                  {selectedEmployee.reworkedTasks.map(t => (
                    <div key={t._id} className="text-xs bg-muted/15 border border-border/30 rounded-lg px-2.5 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground/90 truncate">{t.title}</span>
                        <span className="font-mono font-bold text-amber-400 shrink-0">×{t.reworkCount}</span>
                      </div>
                      {t.lastFeedback && (
                        <p className="text-[11px] text-muted-foreground italic border-l-2 border-amber-500/30 pl-2 leading-relaxed">
                          "{t.lastFeedback}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Estimation Pattern (Locked Logic §10) — a signal, not punitive; always
                shows the specific tasks behind it so root cause is investigable. */}
            {selectedEmployee.recentEstimatedTasks?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                  <TrendingDown className={`h-4 w-4 ${selectedEmployee.hasOverrunPattern ? "text-destructive" : "text-primary"}`} />
                  Estimation Pattern
                </h4>
                {selectedEmployee.hasOverrunPattern ? (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-destructive/25 bg-destructive/5 text-xs">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-destructive">{Math.round(selectedEmployee.recentOverrunProportion * 100)}%</strong> of the last {selectedEmployee.recentEstimatedTasks.length} completed, estimated tasks ran over — worth a look at estimation or workload, not a mark against the employee.
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No overrun pattern in recent completed work.</p>
                )}
                <div className="space-y-1.5">
                  {selectedEmployee.recentEstimatedTasks.map(t => (
                    <div key={t._id} className="flex items-center justify-between gap-2 text-xs border border-border/30 rounded-lg px-2.5 py-1.5 bg-muted/10">
                      <span className="text-foreground/90 truncate">{t.title}</span>
                      <span className={`font-mono font-bold shrink-0 ${t.isOverrun ? "text-destructive" : "text-muted-foreground"}`}>
                        {t.trackedHours}h / {t.estimatedHours}h {t.isOverrun && `(+${t.overrunPercentage}%)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Task Details List */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                <Briefcase className="h-4 w-4 text-primary" /> Task Breakdown & Tracked Time
              </h4>
              {!selectedEmployee.tasks || selectedEmployee.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No tasks logged during this timeframe.</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-card-foreground">
                  {selectedEmployee.tasks.map(t => {
                    const trackedHrs = (t.totalTrackedSeconds / 3600).toFixed(1)
                    return (
                      <div key={t._id} className="border border-border/45 rounded-xl p-3 bg-muted/15 flex items-start justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-foreground/95 flex items-center gap-2">
                            {t.title}
                            <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="text-[8px] py-0 px-1 font-bold tracking-wide uppercase">
                              {t.priority}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground line-clamp-1 text-[11px]">{t.description || "No description provided."}</p>
                          <div className="text-[9px] text-muted-foreground/80 font-medium">
                            Created: {new Date(t.createdAt).toLocaleDateString()}
                            {t.dueDate && ` • Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <Badge className="font-bold uppercase tracking-wider text-[8px] scale-90 origin-right">
                            {t.status}
                          </Badge>
                          <div className="font-mono text-[10px] text-muted-foreground font-bold">
                            Tracked: <span className="text-violet-400">{trackedHrs}h</span> / {t.estimatedHours}h
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" className="rounded-lg" onClick={() => setSelectedEmployee(null)}>
              Close Details
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

export default EmployeeDrilldownModal
