import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatHours } from "../../../../lib/taskFormatters"

// Shared table shape behind DepartmentsReport and TeamsReport — same columns, same
// row logic, differing only in which report array feeds it, the entity-name column
// header, and the completion-rate bar's accent color.
const EntityReportTable = ({ entityLabel, rows, getRowId, barColorClass = "bg-primary" }) => (
  <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
    <Table>
      <TableHeader className="bg-muted/40">
        <TableRow>
          <TableHead className="font-semibold text-foreground/80">{entityLabel}</TableHead>
          <TableHead
            className="font-semibold text-foreground/80 text-center"
            title={`Distinct employees with a task in this report's selected range — not total ${entityLabel.toLowerCase()} headcount`}
          >
            Assignees in Range
          </TableHead>
          <TableHead className="font-semibold text-foreground/80 text-center">Total Tasks</TableHead>
          <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
          <TableHead className="font-semibold text-foreground/80 text-right">Completion Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(r => (
          <TableRow key={getRowId(r)} className="hover:bg-muted/30 transition-colors">
            <TableCell className="font-medium text-sm font-bold text-foreground/90">{r.name}</TableCell>
            <TableCell className="text-center font-bold text-sm">{r.memberCount}</TableCell>
            <TableCell className="text-center font-bold text-sm">
              <div className="flex items-center justify-center gap-1.5">
                <span>{r.total}</span>
                {r.overdue > 0 && <Badge variant="destructive" className="h-4 py-0 px-1 font-bold text-[8px] uppercase">{r.overdue} Overdue</Badge>}
              </div>
            </TableCell>
            <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(r.totalTrackedSeconds)}</TableCell>
            <TableCell className="text-right">
              <div className="flex flex-col items-end gap-1 max-w-[120px] ml-auto">
                <span className="font-mono text-xs font-bold text-foreground">{r.completionRate}%</span>
                <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                  <div className={`${barColorClass} h-full rounded-full`} style={{ width: `${r.completionRate}%` }} />
                </div>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
)

export default EntityReportTable
