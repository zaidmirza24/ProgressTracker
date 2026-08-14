import { useTimer } from "../../../context/TimerContext"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, Check, Repeat, ArrowRightCircle } from "lucide-react"
import { PRIORITY_VARIANTS } from "../../../lib/taskConstants"
import { formatTrackedTime, formatOverrun } from "../../../lib/taskFormatters"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"

// Employee-unique "Today's Daily Tasks" grid (no Manager equivalent). Relocated
// verbatim from the inline EmployeeDashboard. `setDetailTask` opens the shared
// Task Detail modal owned by the shell.
const DailyTasksSection = ({ setDetailTask }) => {
  const tasks = useEmployeeDashboardStore(s => s.tasks)
  const { activeSession, isRunning, startTimer } = useTimer()

  const handlePlayRow = async (e, taskId) => {
    e.stopPropagation()
    // Task list refresh happens automatically via the isPending-gated effect once startTimer settles
    await startTimer(taskId)
  }

  const dailyTasks = tasks.filter(t => t.isDaily)
  const carryForward = dailyTasks.filter(t => !["Completed"].includes(t.status))
  if (dailyTasks.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Today's Daily Tasks</h3>
          <Badge variant="outline" className="text-[10px] font-mono rounded-lg h-5">{dailyTasks.length}</Badge>
        </div>
        {carryForward.length > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
            <ArrowRightCircle className="h-3.5 w-3.5" />
            {carryForward.length} pending / carry-forward
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dailyTasks.map(t => {
          const isDone = ["Completed"].includes(t.status)
          const isActive = activeSession?.task?._id === t._id
          return (
            <div
              key={t._id}
              onClick={() => setDetailTask(t)}
              className={`relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
                isDone
                  ? "border-green-500/30 bg-green-500/5 opacity-70"
                  : isActive
                  ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                  : "border-border/50 bg-card/60 hover:border-primary/30"
              }`}
            >
              {/* Status indicator strip */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isDone ? "bg-green-500" : isActive ? "bg-primary" : "bg-muted"}`} />
              <div className="pl-2 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-bold leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {t.title}
                  </span>
                  {isDone
                    ? <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    : <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[9px] py-0 px-1.5 rounded-sm font-bold shrink-0">{t.priority}</Badge>
                  }
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="violet" className="text-[9px] py-0 px-1.5 rounded-sm font-bold uppercase">
                      <Repeat className="h-2.5 w-2.5 mr-0.5" />Daily
                    </Badge>
                    {t.totalTrackedSeconds > 0 && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {formatTrackedTime(t.totalTrackedSeconds)} tracked
                      </span>
                    )}
                    {formatOverrun(t) && (
                      <Badge variant="destructive" className="text-[9px] py-0 px-1.5 rounded-sm font-bold uppercase">
                        {formatOverrun(t)}
                      </Badge>
                    )}
                  </div>
                  {!isDone && (
                    <button
                      onClick={e => { e.stopPropagation(); handlePlayRow(e, t._id) }}
                      className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                        isActive && isRunning
                          ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {isActive && isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DailyTasksSection
