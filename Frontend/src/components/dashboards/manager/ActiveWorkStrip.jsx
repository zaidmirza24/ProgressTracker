import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../../lib/api"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Radio } from "lucide-react"
import { formatTime } from "../../../lib/taskFormatters"

// "Who is currently working on what, right now" — reads the live WorkSession state
// (stoppedAt: null) via GET /api/work-sessions/active-team, distinct from a task's
// `status: "In Progress"` (which persists across pauses/switches and can go stale).
// A manager sees their direct reports + themselves; super_admin sees the whole org.
const ActiveWorkStrip = () => {
  const [activeWork, setActiveWork] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/work-sessions/active-team`)
        if (!cancelled) setActiveWork(res.data.activeWork || [])
      } catch (err) {
        console.error("Error loading active team sessions:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    // Live-ish view: refresh periodically rather than only on mount, since sessions
    // start/stop outside this page's control.
    const interval = setInterval(load, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (loading || activeWork.length === 0) return null

  return (
    <Card className="border-border/50 p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <Radio className="h-3.5 w-3.5 text-primary animate-pulse" />
        Currently Tracking Time
      </h3>
      <div className="flex flex-wrap gap-2">
        {activeWork.map(w => (
          <Badge
            key={w._id}
            variant="outline"
            className="h-7 px-2.5 rounded-lg font-normal text-xs gap-1.5 border-border/60"
            title={w.task?.title}
          >
            <span className="font-semibold text-foreground/90">{w.employee?.name}</span>
            <span className="text-muted-foreground truncate max-w-[160px]">{w.task?.title}</span>
            <span className="font-mono text-[10px] text-primary">{formatTime(w.elapsedSeconds)}</span>
          </Badge>
        ))}
      </div>
    </Card>
  )
}

export default ActiveWorkStrip
