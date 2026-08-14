import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatHours } from "../../../../lib/taskFormatters"
import useReportsStore from "../../../../store/useReportsStore"

const DepartmentsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { departmentReport } = reports

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-foreground/80">Department</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Active Members</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Total Tasks</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-right">Completion Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {departmentReport.map(d => (
            <TableRow key={d.deptId} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium text-sm font-bold text-foreground/90">{d.name}</TableCell>
              <TableCell className="text-center font-bold text-sm">{d.memberCount}</TableCell>
              <TableCell className="text-center font-bold text-sm">
                <div className="flex items-center justify-center gap-1.5">
                  <span>{d.total}</span>
                  {d.overdue > 0 && <Badge variant="destructive" className="h-4 py-0 px-1 font-bold text-[8px] uppercase">{d.overdue} Overdue</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(d.totalTrackedSeconds)}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1 max-w-[120px] ml-auto">
                  <span className="font-mono text-xs font-bold text-foreground">{d.completionRate}%</span>
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full" style={{ width: `${d.completionRate}%` }} />
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default DepartmentsReport
