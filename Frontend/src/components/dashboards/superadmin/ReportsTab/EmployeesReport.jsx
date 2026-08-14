import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingDown } from "lucide-react"
import { formatHours } from "../../../../lib/taskFormatters"
import useReportsStore from "../../../../store/useReportsStore"

const EmployeesReport = () => {
  const reports = useReportsStore(s => s.reports)
  const setSelectedEmployee = useReportsStore(s => s.setSelectedEmployee)
  const { employeeReport } = reports

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-foreground/80">Employee</TableHead>
            <TableHead className="font-semibold text-foreground/80">Dept & Team</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Tasks</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Completion Rate</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-right">Avg Progress</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employeeReport.map(e => (
            <TableRow key={e._id} onClick={() => setSelectedEmployee(e)} className="hover:bg-muted/30 transition-colors cursor-pointer">
              <TableCell className="font-medium">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
                    {e.name}
                    {e.hasOverrunPattern && (
                      <Badge variant="destructive" className="h-4 py-0 px-1 gap-0.5 font-bold rounded-sm text-[8px] uppercase" title="Recent estimation overrun pattern — see drill-down">
                        <TrendingDown className="h-2.5 w-2.5" /> Pattern
                      </Badge>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{e.email}</span>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-foreground/80">{e.department}</span>
                  <span className="text-xs font-medium text-muted-foreground/80">{e.team}</span>
                </div>
              </TableCell>
              <TableCell className="text-center font-bold text-sm">
                <div className="flex items-center justify-center gap-1.5">
                  <Badge variant="outline" className="font-mono h-5 py-0 px-1.5 font-bold rounded-sm border-border">{e.total}</Badge>
                  {e.overdue > 0 && (
                    <Badge variant="destructive" className="h-5 py-0 px-1 font-bold rounded-sm text-[9px] uppercase">
                      {e.overdue} Late
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="flex flex-col items-center justify-center gap-1 max-w-[100px] mx-auto">
                  <span className="font-mono text-xs font-bold text-foreground">{e.completionRate}%</span>
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${e.completionRate}%` }} />
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(e.totalTrackedSeconds)}</TableCell>
              <TableCell className="text-right font-mono font-bold text-foreground/80 text-sm">{e.avgProgress}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default EmployeesReport
