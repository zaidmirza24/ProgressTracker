import { useState } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { FileText, AlertCircle } from "lucide-react"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"

// Filterable table of daily work logs. `logFilterEmployee` is UI-only, local here —
// no sibling component reads it.
const WorkLogsSection = () => {
  const workLogs = useManagerDashboardStore(s => s.workLogs)
  const employees = useManagerDashboardStore(s => s.employees)
  const [logFilterEmployee, setLogFilterEmployee] = useState("")

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
              {filteredLogs.length} total
            </Badge>
          </CardTitle>
          <CardDescription>Daily productivity reports submitted by employees</CardDescription>
        </div>
        <select
          value={logFilterEmployee}
          onChange={e => setLogFilterEmployee(e.target.value)}
          className="h-10 rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px]"
        >
          <option value="" className="bg-card text-foreground">— Filter Employee —</option>
          {employees.filter(e => e.role === "employee").map(emp => (
            <option key={emp._id} value={emp._id} className="bg-card text-foreground">{emp.name}</option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Employee</TableHead>
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
                      <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[9px] font-bold flex items-center justify-center">
                        {log.employee?.name ? log.employee.name[0].toUpperCase() : "E"}
                      </div>
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
