import { useMemo, useState } from "react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Plus, CheckCircle2, Calendar, AlertTriangle, CalendarOff } from "lucide-react"
import PersonAvatar from "@/components/ui/person-avatar"
import OpenDetailButton from "@/components/ui/open-detail-button"
import { STATUS_VARIANTS, PRIORITY_VARIANTS, formatStatus } from "../../../lib/taskConstants"
import { getEmployeeCapacity, CAPACITY_REASON_LABELS } from "../../../lib/taskHelpers"
import { formatCarryForwardDate, formatBlocked } from "../../../lib/taskFormatters"
import TaskActionMenu from "../../tasks/TaskActionMenu"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"
import useCalendarStore from "../../../store/useCalendarStore"
import AbsenceDialog from "./AbsenceDialog"

// Employee-wise workload cards grid. `openCreateForEmployee` and `setDetailTask`
// are owned by the shell since they drive the shared Create Task / Task Detail modals.
const TeamWorkloadTracker = ({ openCreateForEmployee, setDetailTask, taskActions, submitting }) => {
  const tasks = useManagerDashboardStore(s => s.tasks)
  const employees = useManagerDashboardStore(s => s.employees)
  const calendar = useCalendarStore(s => s.calendar)
  const [absenceTarget, setAbsenceTarget] = useState(null)
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")

  const allEmployees = useMemo(() => employees.filter(emp => emp.role === "employee"), [employees])

  // Options are derived from who's actually visible here, not the full org list — this
  // is what makes the same filter correctly self-scope for both roles: a manager (whose
  // reports usually span one department/team already) sees a filter with nothing to
  // narrow, while a Super Admin (org-wide) sees every department/team that currently has
  // someone in it. Narrowing this view never changes who's actually loaded — Super Admin
  // still has full org-wide data, this is purely display filtering.
  const departmentOptions = useMemo(() => {
    const map = new Map()
    allEmployees.forEach(emp => { if (emp.department) map.set(emp.department._id, emp.department.name) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allEmployees])

  const teamOptions = useMemo(() => {
    const map = new Map()
    allEmployees
      .filter(emp => departmentFilter === "all" || emp.department?._id === departmentFilter)
      .forEach(emp => { if (emp.team) map.set(emp.team._id, emp.team.name) })
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [allEmployees, departmentFilter])

  const visibleEmployees = allEmployees
    .filter(emp => departmentFilter === "all" || emp.department?._id === departmentFilter)
    .filter(emp => teamFilter === "all" || emp.team?._id === teamFilter)

  // Only worth showing when there's actually something to narrow — keeps a manager's
  // already-small, already-scoped view uncluttered.
  const showFilters = departmentOptions.length > 1

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Team Workload & Open Tasks
          </h3>
          <p className="text-sm text-muted-foreground">Monitor pending tasks and allocate new work employee-wise</p>
        </div>
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 bg-muted/20 px-3 py-2 rounded-xl border border-border/40">
            <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground pl-1">Filter:</Label>
            <Select
              value={departmentFilter}
              onValueChange={value => { setDepartmentFilter(value); setTeamFilter("all") }}
            >
              <SelectTrigger className="h-8 w-auto rounded-lg border-input bg-transparent px-2.5 py-1 text-xs shadow-sm">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departmentOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamFilter} onValueChange={setTeamFilter} disabled={teamOptions.length === 0}>
              <SelectTrigger className="h-8 w-auto rounded-lg border-input bg-transparent px-2.5 py-1 text-xs shadow-sm">
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teamOptions.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {showFilters && visibleEmployees.length === 0 && (
        <div className="text-center py-10 border border-dashed border-border/30 rounded-xl bg-muted/5">
          <p className="text-sm font-semibold text-foreground">No one matches this filter</p>
          <p className="text-xs text-muted-foreground mt-1">Try a different department or team.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visibleEmployees.map(emp => {
          // Get open (non-completed) tasks for this employee
          const openTasks = tasks.filter(t => t.assignedTo?._id === emp._id && t.status !== "Completed")
          const inProgress = openTasks.filter(t => t.status === "In Progress").length
          const pendingCount = openTasks.filter(t => t.status === "Pending").length
          const inReview = openTasks.filter(t => t.status === "In Review").length

          const { capacityHours, plannedHours, isOverCapacity, capacityReason, holidayName } =
            getEmployeeCapacity(emp, tasks, 0, new Date(), calendar)
          // Zero capacity (weekend, holiday, leave) is a normal state, not a failure —
          // it must not render as an alarming empty red bar.
          const isUnavailable = capacityHours === 0

          // When someone is over capacity, the manager's next question is "which tasks
          // are causing this?" — so surface the biggest estimates first. Otherwise keep
          // the existing order.
          const empTasks = isOverCapacity
            ? [...openTasks].sort((a, b) => (b.estimatedHours || 0) - (a.estimatedHours || 0))
            : openTasks
          const capacityPct = capacityHours > 0 ? Math.min(100, Math.round((plannedHours / capacityHours) * 100)) : 0

          return (
            <Card key={emp._id} className="border-border/40 bg-card/45 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col justify-between group hover:border-primary/20 transition-all duration-200">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0 gap-4">
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={emp.name} seed={emp._id} fallback="EM" className="h-9 w-9 text-xs" />
                  <div className="flex flex-col">
                    <span className="font-bold text-sm text-foreground/90 leading-tight">{emp.name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-0.5">{emp.team?.name || "Employee"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => setAbsenceTarget(emp)}
                    title={`Record time away for ${emp.name}`}
                  >
                    <CalendarOff className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => openCreateForEmployee(emp._id)}
                    title={`Assign task to ${emp.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
                {/* Today's Capacity (Locked Logic §6 — single-day planning) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-semibold gap-2">
                    <span className="text-muted-foreground uppercase tracking-wider">Today's Capacity</span>
                    {isUnavailable ? (
                      // Neutral tone deliberately — being off is not a problem to flag.
                      <span className="flex items-center gap-1 text-muted-foreground font-bold">
                        <CalendarOff className="h-3 w-3" />
                        {holidayName || CAPACITY_REASON_LABELS[capacityReason] || "Unavailable"}
                      </span>
                    ) : isOverCapacity ? (
                      <span className="flex items-center gap-1 text-destructive font-bold">
                        <AlertTriangle className="h-3 w-3" /> Over Capacity
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {plannedHours}h / {capacityHours}h planned
                        {capacityReason === "half_day" && " · half day"}
                      </span>
                    )}
                  </div>
                  {isUnavailable ? (
                    <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-muted-foreground/20 w-full" />
                    </div>
                  ) : (
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${isOverCapacity ? "bg-destructive" : "bg-primary"}`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  )}
                  {/* Work planned on a day with no capacity is worth surfacing — it's
                      almost always a due date that needs moving. */}
                  {isUnavailable && plannedHours > 0 && (
                    <p className="text-[9px] text-amber-400 font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                      {plannedHours}h of work is scheduled for today anyway
                    </p>
                  )}
                </div>

                {/* Status Metrics Strip */}
                <div className="grid grid-cols-4 gap-2 text-center bg-muted/20 p-2 rounded-xl border border-border/30 text-xs">
                  <div>
                    <div className="font-bold text-foreground">{empTasks.length}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Total</div>
                  </div>
                  <div>
                    <div className="font-bold text-violet-400">{inProgress}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Active</div>
                  </div>
                  <div>
                    <div className="font-bold text-amber-400">{pendingCount}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Paused</div>
                  </div>
                  <div>
                    <div className="font-bold text-warning">{inReview}</div>
                    <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Review</div>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="flex-1 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {empTasks.length === 0 ? (
                    <div className="h-full min-h-[100px] flex flex-col items-center justify-center border border-dashed border-border/20 rounded-xl bg-muted/5 py-6">
                      <CheckCircle2 className="h-5 w-5 text-green-500/60 mb-1" />
                      <p className="text-[11px] text-muted-foreground font-medium">All tasks completed!</p>
                    </div>
                  ) : (
                    empTasks.map(t => (
                      <div
                        key={t._id}
                        onClick={() => setDetailTask(t)}
                        className="p-2.5 rounded-xl border border-border/40 hover:border-primary/20 bg-background/20 hover:bg-background/40 transition-colors cursor-pointer space-y-1 relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <OpenDetailButton
                            onOpen={() => setDetailTask(t)}
                            className="text-[11px] font-bold text-foreground/90 line-clamp-2 leading-tight"
                          >
                            {t.title}
                          </OpenDetailButton>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Estimate drives the capacity bar above — showing it here
                                makes the cause of an overload legible at a glance. */}
                            {t.estimatedHours > 0 && (
                              <span className={`text-[9px] font-bold tabular-nums ${isOverCapacity ? "text-destructive" : "text-muted-foreground"}`}>
                                {t.estimatedHours}h
                              </span>
                            )}
                            <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[7px] py-0 px-1 font-bold rounded-sm">
                              {t.priority}
                            </Badge>
                            {taskActions && (
                              <TaskActionMenu task={t} {...taskActions} disabled={submitting} className="h-5 w-5" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium">
                          <div className="flex items-center gap-1">
                            <Badge variant={STATUS_VARIANTS[t.status]} className="text-[7px] py-0 px-1 rounded-sm">
                              {formatStatus(t.status)}
                            </Badge>
                            {formatBlocked(t) && (
                              <Badge variant="destructive" className="text-[7px] py-0 px-1 rounded-sm font-bold uppercase" title={t.blockedReason}>
                                {formatBlocked(t)}
                              </Badge>
                            )}
                            {t.isCarryForward && (
                              <Badge variant="outline" className="text-[7px] py-0 px-1 rounded-sm font-bold uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                                {formatCarryForwardDate(t) || "Carried"}
                              </Badge>
                            )}
                          </div>
                          {t.dueDate && (
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <AbsenceDialog
        key={absenceTarget?._id}
        employee={absenceTarget}
        open={absenceTarget !== null}
        onOpenChange={(open) => { if (!open) setAbsenceTarget(null) }}
      />
    </div>
  )
}

export default TeamWorkloadTracker
