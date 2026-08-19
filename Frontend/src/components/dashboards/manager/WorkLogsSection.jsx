import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../../lib/api"
import { Link } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import { FileText, AlertCircle, ArrowUpRight } from "lucide-react"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Filterable table of daily work logs. `logFilterEmployee` is UI-only, local here —
// no sibling component reads it.
const WorkLogsSection = () => {
  const workLogs = useManagerDashboardStore(s => s.workLogs)
  const employees = useManagerDashboardStore(s => s.employees)
  const [logFilterEmployee, setLogFilterEmployee] = useState("")
  // Who has actually submitted today. An unenforced daily ritual with no compliance
  // view quietly stops happening — this is the cheapest way to make that visible.
  const [todayStatus, setTodayStatus] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE}/api/daily-work-logs/today-context`)
      .then(res => setTodayStatus(res.data))
      .catch(() => {}) // non-critical; the log table below still renders
  }, [])

  const filteredLogs = logFilterEmployee
    ? workLogs.filter(l => l.employee?._id === logFilterEmployee)
    : workLogs

  return (
    <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-3 gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <FileText className="h-5 w-5 text-primary" />
            Team Work Logs
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs ml-1 font-mono">
              {Math.min(filteredLogs.length, 10)} of {filteredLogs.length}
            </Badge>
          </CardTitle>
          <CardDescription>Most recent submissions, all-time — not limited to today</CardDescription>
          {todayStatus && todayStatus.total > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                todayStatus.missing.length === 0
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              }`}>
                {todayStatus.submitted.length} of {todayStatus.total} submitted today
              </span>
              {todayStatus.missing.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Still to submit: {todayStatus.missing.map(m => m.name).join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={logFilterEmployee || "all"}
            onValueChange={value => setLogFilterEmployee(value === "all" ? "" : value)}
          >
            <SelectTrigger className="h-10 w-auto max-w-[200px] rounded-lg border-input bg-transparent px-3 py-1.5 text-sm shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">— Filter Person —</SelectItem>
              {employees.map(emp => (
                <SelectItem key={emp._id} value={emp._id}>
                  {emp.name}{emp.role && emp.role !== "employee" ? ` (${emp.role === "super_admin" ? "Admin" : "Manager"})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button asChild variant="outline" size="sm" className="h-10 rounded-lg text-xs font-semibold gap-1.5">
            <Link to="/work-logs">
              View All <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Person</TableHead>
                <TableHead className="font-semibold text-foreground/80">Date</TableHead>
                <TableHead className="font-semibold text-foreground/80">Summary of Work Done</TableHead>
                <TableHead className="font-semibold text-foreground/80">Hours</TableHead>
                <TableHead className="font-semibold text-foreground/80">Next Day Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-xs">No daily work logs found.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.slice(0, 10).map(log => (
                <TableRow key={log._id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-1.5">
                      <PersonAvatar name={log.employee?.name} seed={log.employee?._id} fallback="E" className="h-5 w-5 text-[9px]" />
                      <span>{log.employee?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs font-semibold uppercase tracking-wider">
                    {new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <p className="truncate text-sm text-foreground/80" title={log.todaysWork}>{log.todaysWork}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs font-bold rounded-md bg-muted/40">{log.hoursWorked}h</Badge>
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <p className="truncate text-xs text-muted-foreground" title={log.nextPlan}>{log.nextPlan || "—"}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export default WorkLogsSection
