import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatHours } from "../../../../lib/taskFormatters"
import useReportsStore from "../../../../store/useReportsStore"

const TeamsReport = () => {
  const reports = useReportsStore(s => s.reports)
  const { teamReport } = reports

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-foreground/80">Team</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Active Members</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Total Tasks</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
            <TableHead className="font-semibold text-foreground/80 text-right">Completion Rate</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamReport.map(t => (
            <TableRow key={t.teamId} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-medium text-sm font-bold text-foreground/90">{t.name}</TableCell>
              <TableCell className="text-center font-bold text-sm">{t.memberCount}</TableCell>
              <TableCell className="text-center font-bold text-sm">
                <div className="flex items-center justify-center gap-1.5">
                  <span>{t.total}</span>
                  {t.overdue > 0 && <Badge variant="destructive" className="h-4 py-0 px-1 font-bold text-[8px] uppercase">{t.overdue} Overdue</Badge>}
                </div>
              </TableCell>
              <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(t.totalTrackedSeconds)}</TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end gap-1 max-w-[120px] ml-auto">
                  <span className="font-mono text-xs font-bold text-foreground">{t.completionRate}%</span>
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${t.completionRate}%` }} />
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

export default TeamsReport
