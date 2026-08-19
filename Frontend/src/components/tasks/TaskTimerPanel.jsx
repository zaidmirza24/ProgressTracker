import { Button } from "@/components/ui/button"
import { Clock, Play, Pause, Square, Loader2 } from "lucide-react"
import { useTimer } from "../../context/TimerContext"
import { formatTime } from "../../lib/taskFormatters"

// Employee-only: Start/Pause/Resume/Stop for this task. Self-contained — decides on
// its own whether there's anything to show, so the shell doesn't need to know the
// status rule.
const TaskTimerPanel = ({ detailTask }) => {
  const { activeSession, elapsedSeconds, isRunning, isPending, startTimer, pauseTimer, resumeTimer, stopTimer } = useTimer()

  if (["Completed", "In Review"].includes(detailTask.status)) return null

  const isThisTaskActive = activeSession && activeSession.task?._id === detailTask._id

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-gradient-to-r from-card to-card/60 flex items-center justify-between shadow-sm relative overflow-hidden">
      <div className="space-y-0.5">
        <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
          <Clock className="h-4 w-4 text-primary" />
          Time Tracking
        </h4>
        <p className="text-xs text-muted-foreground">
          {isThisTaskActive ? "Currently active on your sidebar" : "Start a timer session to begin"}
        </p>
      </div>
      <div>
        {isThisTaskActive ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-tight bg-muted border border-border px-3 py-1.5 rounded-lg">
              {formatTime(elapsedSeconds)}
            </span>
            {isRunning ? (
              <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={pauseTimer} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Pause className="h-3.5 w-3.5 mr-1" />} Pause
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={resumeTimer} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1 text-primary" />} Resume
              </Button>
            )}
            <Button size="sm" variant="destructive" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={stopTimer} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1" />} Stop
            </Button>
          </div>
        ) : (
          <Button size="sm" className="rounded-lg shadow font-semibold disabled:opacity-60" onClick={() => startTimer(detailTask._id)} disabled={isPending}>
            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Start Timer
          </Button>
        )}
      </div>
    </div>
  )
}

export default TaskTimerPanel
