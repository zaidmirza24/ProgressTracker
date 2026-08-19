import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarRange } from "lucide-react"
import PersonAvatar from "@/components/ui/person-avatar"
import { getCapacityForecast, CAPACITY_REASON_LABELS, isWorkingDay } from "../../../lib/taskHelpers"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"
import useCalendarStore from "../../../store/useCalendarStore"

const FORECAST_DAYS = 7

// Utilization -> cell shading. Mirrors Locked Logic §7 ("low utilization is a signal
// only, never auto-labeled low productivity") by keeping shading a visual signal rather
// than a verdict — over-capacity is the only state called out explicitly.
const cellClass = (pct, isOverCapacity, isUnavailable) => {
  // A non-working day or an absence is not an under-utilised day — it's a day that
  // doesn't apply. Render it as inert rather than as "0% used".
  if (isUnavailable) return "bg-muted/20 text-muted-foreground/50 border border-dashed border-border/40"
  if (isOverCapacity) return "bg-destructive/70 text-destructive-foreground"
  if (pct >= 85) return "bg-amber-500/60 text-foreground"
  if (pct >= 50) return "bg-primary/35 text-foreground"
  if (pct > 0) return "bg-primary/15 text-foreground"
  return "bg-muted/30 text-muted-foreground"
}

// V2 preview (Locked Logic §6 explicitly deferred multi-day capacity planning): a
// person x day grid of planned-vs-capacity hours for the coming week, built entirely
// from the same single-day capacity math TeamWorkloadTracker uses for "today".
const TeamCapacityForecast = () => {
  const tasks = useManagerDashboardStore(s => s.tasks)
  const employees = useManagerDashboardStore(s => s.employees).filter(emp => emp.role === "employee")
  const calendar = useCalendarStore(s => s.calendar)

  if (employees.length === 0) return null

  const today = new Date()
  const days = Array.from({ length: FORECAST_DAYS }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          Team Capacity Forecast
          <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0 border-primary/30 text-primary/80">
            Preview
          </Badge>
        </h3>
        <p className="text-sm text-muted-foreground">Forward-looking, planned load vs. capacity for the next {FORECAST_DAYS} days — spot overload before it happens</p>
      </div>
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left font-semibold text-foreground/80 p-3 sticky left-0 bg-card/95 backdrop-blur-sm">Employee</th>
                  {days.map(d => {
                    const working = isWorkingDay(d, calendar)
                    return (
                      <th key={d.toISOString()} className={`p-3 text-center font-semibold min-w-[64px] ${working ? "text-foreground/70" : "text-muted-foreground/50"}`}>
                        <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const forecast = getCapacityForecast(emp, tasks, FORECAST_DAYS, today, calendar)
                  return (
                    <tr key={emp._id} className="border-b border-border/20 last:border-0">
                      <td className="p-3 sticky left-0 bg-card/95 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={emp.name} seed={emp._id} fallback="EM" className="h-6 w-6 text-[9px]" />
                          <span className="font-semibold text-foreground/90 whitespace-nowrap">{emp.name}</span>
                        </div>
                      </td>
                      {forecast.map(f => {
                        const pct = f.capacityHours > 0 ? Math.round((f.plannedHours / f.capacityHours) * 100) : 0
                        const isUnavailable = f.capacityHours === 0
                        const reasonLabel = f.holidayName || CAPACITY_REASON_LABELS[f.capacityReason]
                        const title = isUnavailable
                          ? `${reasonLabel || "Unavailable"}${f.plannedHours > 0 ? ` — but ${f.plannedHours}h is scheduled` : ""}`
                          : `${f.plannedHours}h planned / ${f.capacityHours}h capacity`
                        return (
                          <td key={f.date.toISOString()} className="p-1.5 text-center">
                            <div
                              title={title}
                              className={`rounded-lg py-2 font-bold font-mono text-[11px] ${cellClass(pct, f.isOverCapacity, isUnavailable)}`}
                            >
                              {isUnavailable
                                ? (f.plannedHours > 0 ? `⚠ ${f.plannedHours}h` : "—")
                                : `${f.plannedHours}h`}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default TeamCapacityForecast
