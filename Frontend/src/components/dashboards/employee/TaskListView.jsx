import { useTimer } from "../../../context/TimerContext"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import TaskActionMenu from "../../tasks/TaskActionMenu"
import OpenDetailButton from "@/components/ui/open-detail-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import { Clock, Calendar, Play, Pause, Square, AlertCircle, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { STATUS_VARIANTS, PRIORITY_VARIANTS, formatStatus } from "../../../lib/taskConstants"
import { formatTrackedTime, formatOverrun, formatCarryForwardDate, formatBlocked } from "../../../lib/taskFormatters"
import { isSelfCreated, isTaskOverdue, getNextStatuses } from "../../../lib/taskHelpers"

// Employee's table/list view of tasks, relocated verbatim from the inline
// EmployeeDashboard's viewMode === "list" branch. `filteredTasks`/`loading` come from
// the shell (search-filtered `tasks`); `setDetailTask` opens the shared Task Detail
// modal; `handleStatusTransition` is the shell's shared useTaskStatusMutation wrapper.
const TaskListView = ({ filteredTasks, loading, searchQuery, setDetailTask, handleStatusTransition, buildTaskActions, submitting }) => {
  const { activeSession, isRunning, isPending, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()

  const handlePlayRow = async (e, taskId) => {
    e.stopPropagation()
    // Task list refresh happens automatically via the isPending-gated effect once startTimer settles
    await startTimer(taskId)
  }

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-foreground/80">Task</TableHead>
            <TableHead className="font-semibold text-foreground/80">Assigned By</TableHead>
            <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
            <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
            <TableHead className="font-semibold text-foreground/80">Status Workflow</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Track Time</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-12">
                <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Clock className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-sm">Loading assigned tasks...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : filteredTasks.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-16">
                <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">No tasks found</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {searchQuery ? `We couldn't find any tasks matching "${searchQuery}".` : "Once your manager assigns a task to your name or you create one yourself, it will show up here."}
                    </p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTasks.map(t => {
                const isTaskActive = activeSession && activeSession.task?._id === t._id
                const nextOptions = getNextStatuses(t)
                const selfCreated = isSelfCreated(t)

                return (
                  <motion.tr
                    key={t._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.8 }}
                    className={`border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors ${
                      isTaskActive ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : ""
                    }`}
                    onClick={() => setDetailTask(t)}
                  >
                    <TableCell className="font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                        <OpenDetailButton onOpen={() => setDetailTask(t)} className="font-bold">
                          {t.title}
                        </OpenDetailButton>
                        {selfCreated && !t.isDaily && (
                          <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                        )}
                        {t.isDaily && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-primary/30 text-primary bg-primary/5">
                            Daily
                          </Badge>
                        )}
                        {t.isCarryForward && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                            {formatCarryForwardDate(t) || "Carried Over"}
                          </Badge>
                        )}
                        {formatBlocked(t) && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1.5 rounded-sm font-bold uppercase" title={t.blockedReason}>
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
                      <PersonAvatar name={t.assignedBy?.name} seed={t.assignedBy?._id} fallback="M" className="h-5 w-5 text-[10px]" />
                      <span>{selfCreated ? "Self-Assigned" : (t.assignedBy?.name || "Manager")}</span>
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
                            <Calendar className="h-3.5 w-3.5" />
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
                        onValueChange={value => handleStatusTransition(value, t._id)}
                      >
                        <SelectTrigger className="h-8 w-auto min-w-[150px] gap-1.5 rounded-lg border-input bg-card text-foreground px-2 py-0.5 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={t.status}>{formatStatus(t.status)}</SelectItem>
                          {nextOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>➔ {opt === "Completed" ? "Complete Task" : opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                        {t.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                    {isTaskActive ? (
                      <div className="flex items-center justify-center gap-1">
                        {isRunning ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-60"
                            onClick={pauseTimer}
                            disabled={isPending}
                            title="Pause timer"
                          >
                            {isPending
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Pause className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-green-500 hover:text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                            onClick={resumeTimer}
                            disabled={isPending}
                            title="Resume timer"
                          >
                            {isPending
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <Play className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-60"
                          onClick={stopTimer}
                          disabled={isPending}
                          title="Stop timer"
                        >
                          {isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Square className="h-4 w-4" />}
                        </Button>
                      </div>
                    ) : (
                      !["Completed", "In Review"].includes(t.status) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                          onClick={e => handlePlayRow(e, t._id)}
                          disabled={isPending}
                          title="Start timer"
                        >
                          {isPending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Play className="h-4 w-4" />}
                        </Button>
                      )
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
                    {buildTaskActions && (
                      <TaskActionMenu task={t} {...buildTaskActions(t)} disabled={submitting} />
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
  )
}

export default TaskListView
