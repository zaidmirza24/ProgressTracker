import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Clock } from "lucide-react"
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"
import useReportsStore from "../../../../store/useReportsStore"

const AnalyticsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { departmentReport, healthReport } = reports

  const statusData = [
    { name: "Not Started", value: healthReport.notStartedTasks, color: "#94a3b8" },
    { name: "In Progress", value: healthReport.inProgressTasks, color: "#38bdf8" },
    { name: "Pending", value: healthReport.pendingTasks, color: "#fbbf24" },
    { name: "In Review", value: healthReport.inReviewTasks, color: "#fb7185" },
    { name: "Completed", value: healthReport.completedTasks, color: "#4ade80" }
  ].filter(d => d.value > 0)

  const deptHoursData = departmentReport.map(d => ({
    name: d.name,
    hours: parseFloat((d.totalTrackedSeconds / 3600).toFixed(1))
  }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Task Status Donut Chart */}
      <Card className="border-border/50 bg-background/25 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary" /> Task Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {statusData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No tasks in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#151525", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px", color: "#f8fafc" }}
                />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Department Tracked Hours Bar Chart */}
      <Card className="border-border/50 bg-background/25 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-violet-400" /> Tracked Hours by Department
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          {deptHoursData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No hours tracked in this period</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptHoursData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ backgroundColor: "#151525", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px", color: "#f8fafc" }}
                />
                <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tracked Hours" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default AnalyticsReport
