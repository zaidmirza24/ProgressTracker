import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import { Clock, AlertCircle, Calendar, X } from "lucide-react"
import { STATUS_VARIANTS, PRIORITY_VARIANTS, formatStatus } from "../../../lib/taskConstants"
import { formatTrackedTime, formatOverrun, formatCarryForwardDate, formatBlocked, formatRework } from "../../../lib/taskFormatters"
import { isSelfCreated, isTaskOverdue, getNextStatusesForManager } from "../../../lib/taskHelpers"
import TaskActionMenu from "../../tasks/TaskActionMenu"
import OpenDetailButton from "@/components/ui/open-detail-button"
import ScopeToggle from "../../tasks/ScopeToggle"
import { filterTasksByScope, SCOPE_LABELS, TASK_SCOPES } from "../../../lib/taskScope"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Searchable task table with inline status-transition dropdown. `updateTaskStatus`
// comes from the shell's shared useTaskStatusMutation instance; `setDetailTask` opens
// the shared Task Detail modal (row click, or an In Review row's dropdown).
const TeamTasksTable = ({ updateTaskStatus, setDetailTask, loading, taskActions, submitting }) => {
  const tasks = useManagerDashboardStore(s => s.tasks)
  const [searchQuery, setSearchQuery] = useState("")
  // Filter lives in the URL, not local state — it's shareable, bookmarkable, and lets
  // the Attention Zone deep-link straight into "the overdue ones" (§24).
  const [searchParams, setSearchParams] = useSearchParams()
  const activeFilter = searchParams.get("filter") || ""
  // Scope narrows the VIEW only — the store keeps every task, because the capacity bars
  // and 7-day forecast on the Overview page are derived from that same array and need
  // future-dated work. Kept in the URL alongside `filter` so a view is shareable (§24).
  const scopeParam = searchParams.get("scope")
  const scope = TASK_SCOPES.includes(scopeParam) ? scopeParam : "week"

  const setScope = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === "week") params.delete("scope")
    else params.set("scope", next)
    setSearchParams(params, { replace: true })
  }

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("filter")
    setSearchParams(next, { replace: true })
  }

  const FILTER_LABELS = { overdue: "Overdue", review: "Awaiting review", pending: "Paused", blocked: "Blocked" }
  const matchesFilter = (t) => {
    if (activeFilter === "overdue") return isTaskOverdue(t)
    if (activeFilter === "review") return t.status === "In Review"
    if (activeFilter === "pending") return t.status === "Pending"
    if (activeFilter === "blocked") return Boolean(t.isBlocked)
    return true
  }

  const scopedTasks = filterTasksByScope(tasks, scope)

  const filteredTasks = scopedTasks.filter(t => {
    const matchesSearch = searchQuery
      ? (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.priority?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.assignedTo?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    return matchesSearch && matchesFilter(t)
  })

  return (
    <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Input
            placeholder="🔍 Search tasks..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-xs rounded-lg bg-background/50 border-border/40 max-w-[200px]"
          />
          <ScopeToggle scope={scope} onChange={setScope} />
          {activeFilter && (
            <button
              type="button"
              onClick={clearFilter}
              className="h-6 px-2 inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 text-primary text-[11px] font-bold shrink-0 hover:bg-primary/20 transition-colors"
            >
              {FILTER_LABELS[activeFilter] || activeFilter}: {filteredTasks.length}
              <X className="h-3 w-3" />
            </button>
          )}
          <Badge variant="outline" className="h-6 font-mono rounded-lg shrink-0" title={`${tasks.length} tasks in total across all time`}>
            {scopedTasks.length}{scope !== "all" && ` of ${tasks.length}`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                <TableHead className="font-semibold text-foreground/80">Assigned To</TableHead>
                <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                <TableHead className="font-semibold text-foreground/80">Status Workflow</TableHead>
                <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <Clock className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm">Loading tasks...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16">
                    <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-foreground">
                          {activeFilter ? `Nothing ${(FILTER_LABELS[activeFilter] || activeFilter).toLowerCase()}` : "No tasks found"}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {searchQuery
                            ? `We couldn't find any tasks matching "${searchQuery}".`
                            : activeFilter
                              ? "Nothing in the team's tasks matches this filter right now — which is good news."
                              : scope !== "all"
                                ? `No team tasks fall within ${SCOPE_LABELS[scope].toLowerCase()}. Switch to All time to see everything.`
                                : 'Click "Create Task" to assign your first task to the team.'}
                        </p>
                        {activeFilter && (
                          <button type="button" onClick={clearFilter} className="text-xs font-semibold text-primary hover:underline pt-1">
                            Show all tasks
                          </button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredTasks.map(t => {
                    const nextOptions = getNextStatusesForManager(t)
                    const selfCreated = isSelfCreated(t)

                    return (
                      <motion.tr
                        key={t._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.8 }}
                        className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setDetailTask(t)}
                      >
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
                            <OpenDetailButton onOpen={() => setDetailTask(t)} className="font-bold">
                              {t.title}
                            </OpenDetailButton>
                            {selfCreated && (
                              <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                            )}
                            {t.isCarryForward && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                                {formatCarryForwardDate(t) || "Carried Over"}
                              </Badge>
                            )}
                            {formatRework(t) && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/40 text-amber-400" title="Sent back for rework before">
                                {formatRework(t)}
                              </Badge>
                            )}
                            {formatBlocked(t) && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase" title={t.blockedReason}>
                                {formatBlocked(t)}
                              </Badge>
                            )}
                            {formatOverrun(t) && (
                              <Badge variant="destructive" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">
                                {formatOverrun(t)}
                              </Badge>
                            )}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                            {t.category}
                            {t.totalTrackedSeconds > 0 && (
                              <>
                                <span className="text-muted-foreground/40">•</span>
                                <span className="text-violet-400">{formatTrackedTime(t.totalTrackedSeconds)} tracked</span>
                              </>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1.5">
                          <PersonAvatar name={t.assignedTo?.name} seed={t.assignedTo?._id} fallback="—" className="h-5 w-5 text-[9px]" />
                          <span>{t.assignedTo?.name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[10px] py-0.5 px-2 rounded-md font-bold">
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {t.dueDate ? (
                          (() => {
                            const overdue = isTaskOverdue(t)
                            return (
                              <span className={`flex items-center gap-1.5 ${overdue ? "text-destructive font-semibold" : ""}`}>
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                                {overdue && "⚠️ "}
                                {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )
                          })()
                        ) : "—"}
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {nextOptions.length > 0 ? (
                          <Select
                            value={t.status}
                            onValueChange={value => {
                              // Approving/reworking an In Review task requires feedback — open the modal instead
                              if (t.status === "In Review") {
                                setDetailTask(t)
                                return
                              }
                              // Update other transitions inline, optimistically
                              updateTaskStatus(t._id, value, "")
                            }}
                          >
                            <SelectTrigger className="h-8 w-auto min-w-[150px] gap-1.5 rounded-lg border-input bg-card text-foreground px-2 py-0.5 text-xs font-semibold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={t.status}>{formatStatus(t.status)}</SelectItem>
                              {nextOptions.map(opt => (
                                <SelectItem key={opt} value={opt}>➔ {formatStatus(opt)}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                            {t.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden hidden sm:block">
                            <div
                              className="bg-primary h-full rounded-full transition-all duration-300"
                              style={{ width: `${t.progressPercentage}%` }}
                            ></div>
                          </div>
                          <span className="font-mono text-xs font-semibold text-foreground/80">
                            {t.progressPercentage}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell onClick={e => e.stopPropagation()} className="text-right">
                        {taskActions && (
                          <TaskActionMenu task={t} {...taskActions} disabled={submitting} />
                        )}
                      </TableCell>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default TeamTasksTable
