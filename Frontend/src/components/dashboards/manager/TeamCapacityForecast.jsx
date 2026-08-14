import { Card, CardContent } from "@/components/ui/card"
import { CalendarRange } from "lucide-react"
import { getInitials } from "../../../lib/taskFormatters"
import { getCapacityForecast } from "../../../lib/taskHelpers"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

const FORECAST_DAYS = 7

// Utilization -> cell shading. Mirrors Locked Logic §7 ("low utilization is a signal
// only, never auto-labeled low productivity") by keeping shading a visual signal rather
// than a verdict — over-capacity is the only state called out explicitly.
const cellClass = (pct, isOverCapacity) => {
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
        </h3>
        <p className="text-sm text-muted-foreground">Planned load vs. capacity for the next {FORECAST_DAYS} days — spot overload before it happens</p>
      </div>
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left font-semibold text-foreground/80 p-3 sticky left-0 bg-card/95 backdrop-blur-sm">Employee</th>
                  {days.map(d => (
                    <th key={d.toISOString()} className="p-3 text-center font-semibold text-foreground/70 min-w-[64px]">
                      <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      <div className="text-[10px] text-muted-foreground font-normal">{d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const forecast = getCapacityForecast(emp, tasks, FORECAST_DAYS, today)
                  return (
                    <tr key={emp._id} className="border-b border-border/20 last:border-0">
                      <td className="p-3 sticky left-0 bg-card/95 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
                            {getInitials(emp.name, "EM")}
                          </div>
                          <span className="font-semibold text-foreground/90 whitespace-nowrap">{emp.name}</span>
                        </div>
                      </td>
                      {forecast.map(f => {
                        const pct = f.capacityHours > 0 ? Math.round((f.plannedHours / f.capacityHours) * 100) : 0
                        return (
                          <td key={f.date.toISOString()} className="p-1.5 text-center">
                            <div
                              title={`${f.plannedHours}h planned / ${f.capacityHours}h capacity`}
                              className={`rounded-lg py-2 font-bold font-mono text-[11px] ${cellClass(pct, f.isOverCapacity)}`}
                            >
                              {f.plannedHours}h
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
