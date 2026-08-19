import { useTimer } from "../../../context/TimerContext"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import TaskActionMenu from "../../tasks/TaskActionMenu"
import OpenDetailButton from "@/components/ui/open-detail-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import { Calendar, Play, Pause, Square, Loader2 } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { PRIORITY_VARIANTS, formatStatus } from "../../../lib/taskConstants"
import { formatTrackedTime, formatTime, formatOverrun, formatCarryForwardDate, formatBlocked } from "../../../lib/taskFormatters"
import { isSelfCreated, isTaskOverdue, getNextStatuses } from "../../../lib/taskHelpers"

// Employee's Kanban board view, relocated verbatim from the inline EmployeeDashboard's
// viewMode === "board" branch (including the 5-column `getBoardColumns()` grouping
// logic, kept local here since no sibling component needs it). `filteredTasks` comes
// from the shell (search-filtered `tasks`); `setDetailTask` opens the shared Task
// Detail modal; `handleStatusTransition` is the shell's shared useTaskStatusMutation wrapper.
const TaskKanbanBoard = ({ filteredTasks, setDetailTask, handleStatusTransition, buildTaskActions, submitting }) => {
  const { activeSession, elapsedSeconds, isRunning, isPending, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()

  const handlePlayRow = async (e, taskId) => {
    e.stopPropagation()
    // Task list refresh happens automatically via the isPending-gated effect once startTimer settles
    await startTimer(taskId)
  }

  const getBoardColumns = () => {
    const columns = {
      todo: {
        title: "Not Started",
        tasks: [],
        color: "border-slate-500 bg-slate-500/5",
        badgeColor: "bg-slate-500/10 text-slate-400",
        indicatorColor: "bg-slate-400"
      },
      inProgress: {
        title: "In Progress",
        tasks: [],
        color: "border-violet-500 bg-violet-500/5",
        badgeColor: "bg-violet-500/10 text-violet-400",
        indicatorColor: "bg-violet-500"
      },
      pending: {
        title: "Paused",
        tasks: [],
        color: "border-amber-500 bg-amber-500/5",
        badgeColor: "bg-amber-500/10 text-amber-400",
        indicatorColor: "bg-amber-500"
      },
      underReview: {
        title: "In Review",
        tasks: [],
        color: "border-sky-500 bg-sky-500/5",
        badgeColor: "bg-sky-500/10 text-sky-400",
        indicatorColor: "bg-sky-500"
      },
      completed: {
        title: "Completed",
        tasks: [],
        color: "border-green-500 bg-green-500/5",
        badgeColor: "bg-green-500/10 text-green-400",
        indicatorColor: "bg-green-500"
      }
    }

    filteredTasks.forEach(task => {
      switch (task.status) {
        case "Not Started":
          columns.todo.tasks.push(task)
          break
        case "In Progress":
          columns.inProgress.tasks.push(task)
          break
        case "Pending":
          columns.pending.tasks.push(task)
          break
        case "In Review":
          columns.underReview.tasks.push(task)
          break
        case "Completed":
          columns.completed.tasks.push(task)
          break
        default:
          columns.todo.tasks.push(task)
      }
    })

    return columns
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-y-6 lg:gap-y-0 lg:divide-x lg:divide-border/60">
      {Object.entries(getBoardColumns()).map(([colId, col]) => (
        <div key={colId} className="flex flex-col space-y-3 lg:px-4 first:lg:pl-0 last:lg:pr-0">
          {/* Column Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${col.indicatorColor}`} />
              <h3 className="font-bold text-xs uppercase tracking-wider text-foreground/80">{col.title}</h3>
            </div>
            <Badge variant="outline" className={`font-mono text-[10px] font-semibold rounded-md ${col.badgeColor}`}>
              {col.tasks.length}
            </Badge>
          </div>

          {/* Column Task Cards */}
          <div className="flex flex-col gap-3 min-h-[350px] rounded-xl bg-muted/5 border border-dashed border-border/10 p-2">
            {col.tasks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border/15 rounded-xl bg-card/10 h-full min-h-[150px]"
              >
                <span className="text-[11px] text-muted-foreground font-medium">No tasks</span>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                {col.tasks.map(t => {
                  const isTaskActive = activeSession && activeSession.task?._id === t._id
                  const overdue = isTaskOverdue(t)
                  const selfCreated = isSelfCreated(t)
                  const nextOptions = getNextStatuses(t)

                  return (
                    <motion.div
                      key={t._id}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94, y: -8 }}
                      transition={{
                        type: "spring",
                        stiffness: 450,
                        damping: 38,
                        mass: 0.9,
                        layout: { type: "spring", stiffness: 400, damping: 36 }
                      }}
                      onClick={() => setDetailTask(t)}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border overflow-hidden bg-card/30 hover:bg-card/60 backdrop-blur-sm cursor-pointer ${
                        isTaskActive
                          ? "border-primary/45 shadow-sm ring-1 ring-primary/20 bg-primary/[0.02]"
                          : overdue
                            ? "border-destructive/40 bg-destructive/[0.01] hover:border-destructive/60"
                            : "border-border/50 hover:border-primary/30"
                      }`}
                      whileHover={{ y: -2, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                    >
                      {/* Left indicator accent */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                        isTaskActive ? "bg-primary" :
                        overdue ? "bg-destructive" :
                        colId === "todo" ? "bg-slate-500" :
                        colId === "inProgress" ? "bg-violet-500" :
                        colId === "pending" ? "bg-amber-500" :
                        colId === "underReview" ? "bg-sky-500" : "bg-green-500"
                      }`} />

                    {/* Card actions — absolutely positioned so the card's own onClick
                        (open detail) keeps working everywhere else. */}
                    {buildTaskActions && (
                      <div className="absolute top-2 right-1.5 z-10">
                        <TaskActionMenu task={t} {...buildTaskActions(t)} disabled={submitting} className="h-6 w-6" />
                      </div>
                    )}

                    <div className="pl-1.5 space-y-2">
                      <div className="flex items-start justify-between gap-2 pr-6">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate max-w-[120px]">
                          {t.category}
                        </span>
                        <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[8px] py-0 px-1.5 font-bold rounded-sm shrink-0">
                          {t.priority}
                        </Badge>
                      </div>

                      <h4 className="text-sm font-bold text-foreground leading-snug tracking-tight">
                        <OpenDetailButton onOpen={() => setDetailTask(t)} className="font-bold leading-snug tracking-tight">
                          {t.title}
                        </OpenDetailButton>
                      </h4>

                      {/* Action Badges */}
                      <div className="flex flex-wrap gap-1">
                        {selfCreated && !t.isDaily && (
                          <Badge variant="violet" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                        )}
                        {t.isDaily && (
                          <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase border-primary/30 text-primary bg-primary/5">
                            Daily
                          </Badge>
                        )}
                        {t.isCarryForward && (
                          <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                            {formatCarryForwardDate(t) || "Carried Over"}
                          </Badge>
                        )}
                        {formatBlocked(t) && (
                          <Badge variant="destructive" className="text-[9px] py-0 px-1.5 rounded-sm font-bold uppercase" title={t.blockedReason}>
                            {formatBlocked(t)}
                          </Badge>
                        )}
                        {formatOverrun(t) && (
                          <Badge variant="destructive" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase">
                            {formatOverrun(t)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Separator line */}
                    <div className="h-px bg-border/30 my-3 ml-1.5" />

                    <div className="pl-1.5 flex flex-col gap-2.5">
                      {/* Metadata row */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                        <div className="flex items-center gap-1.5">
                          <PersonAvatar name={t.assignedBy?.name} seed={t.assignedBy?._id} fallback="M" className="h-4.5 w-4.5 text-[8px]" />
                          <span className="truncate max-w-[80px]">
                            {selfCreated ? "Self" : (t.assignedBy?.name || "Manager")}
                          </span>
                        </div>

                        {t.dueDate && (
                          <span className={`flex items-center gap-1 shrink-0 ${overdue ? "text-destructive font-semibold" : ""}`}>
                            <Calendar className="h-3 w-3" />
                            {overdue && "⚠️ "}
                            {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                        <div className="flex-1 bg-muted/65 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${t.progressPercentage}%` }}
                          ></div>
                        </div>
                        <span className="font-mono font-bold shrink-0">{t.progressPercentage}%</span>
                      </div>

                      {/* Bottom interactive controls — timer row, then a full-width status row so
                          the select always has enough room for its longest label */}
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-1.5">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">
                            {isTaskActive ? "Active Session" : "Tracked"}
                          </span>
                          <span className={`font-mono text-xs font-bold ${isTaskActive ? "text-primary animate-pulse" : "text-violet-400"}`}>
                            {isTaskActive ? formatTime(elapsedSeconds) : formatTrackedTime(t.totalTrackedSeconds)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Play timer controls */}
                          {isTaskActive ? (
                            <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                              {isRunning ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-md text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-60 animate-pulse"
                                  onClick={pauseTimer}
                                  disabled={isPending}
                                  title="Pause timer"
                                >
                                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-md text-green-500 hover:text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                                  onClick={resumeTimer}
                                  disabled={isPending}
                                  title="Resume timer"
                                >
                                  {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-60"
                                onClick={stopTimer}
                                disabled={isPending}
                                title="Stop timer"
                              >
                                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                              </Button>
                            </div>
                          ) : (
                            !["Completed", "In Review"].includes(t.status) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                                onClick={e => handlePlayRow(e, t._id)}
                                disabled={isPending}
                                title="Start timer"
                              >
                                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              </Button>
                            )
                          )}
                        </div>
                        </div>

                        {/* Quick workflow transition selection — own row, full card width */}
                        {nextOptions.length > 0 && (
                          <Select
                            value={t.status}
                            onValueChange={value => handleStatusTransition(value, t._id)}
                          >
                            <SelectTrigger className="h-7 w-full gap-1 rounded-md border-input bg-card text-foreground px-2 py-0.5 text-[10px] font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={t.status}>{formatStatus(t.status)}</SelectItem>
                              {nextOptions.map(opt => (
                                <SelectItem key={opt} value={opt}>➔ {opt === "Completed" ? "Complete" : opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default TaskKanbanBoard
