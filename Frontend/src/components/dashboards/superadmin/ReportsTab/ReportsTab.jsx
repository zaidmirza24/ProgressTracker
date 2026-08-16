import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, BarChart3, Briefcase, Calendar, CheckCircle2, Clock, Gauge, TrendingDown, TrendingUp } from "lucide-react"
import { formatHours } from "../../../../lib/taskFormatters"
import useReportsStore from "../../../../store/useReportsStore"
import EmployeesReport from "./EmployeesReport"
import DepartmentsReport from "./DepartmentsReport"
import TeamsReport from "./TeamsReport"
import AnalyticsReport from "./AnalyticsReport"
import InsightsReport from "./InsightsReport"
import EmployeeDrilldownModal from "./EmployeeDrilldownModal"

const ReportsTab = () => {
  const reports = useReportsStore(s => s.reports)
  const loading = useReportsStore(s => s.loading)
  const error = useReportsStore(s => s.error)
  const activeSubTab = useReportsStore(s => s.activeSubTab)
  const timeframe = useReportsStore(s => s.timeframe)
  const startDate = useReportsStore(s => s.startDate)
  const endDate = useReportsStore(s => s.endDate)
  const fetchReports = useReportsStore(s => s.fetchReports)
  const setActiveSubTab = useReportsStore(s => s.setActiveSubTab)
  const setTimeframe = useReportsStore(s => s.setTimeframe)
  const setStartDate = useReportsStore(s => s.setStartDate)
  const setEndDate = useReportsStore(s => s.setEndDate)

  useEffect(() => {
    fetchReports()
  }, [timeframe, startDate, endDate])

  if (error && !reports) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-semibold text-foreground">Couldn't load reports</p>
            <p className="text-sm text-muted-foreground">Something went wrong fetching the latest data. Please try again.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchReports}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  if (loading || !reports) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl w-full" />
      </div>
    )
  }

  const { healthReport, employeeReport } = reports
  const overCapacityCount = employeeReport?.filter(e => e.isCapacityOverrunToday).length ?? 0
  const patternCount = employeeReport?.filter(e => e.hasOverrunPattern).length ?? 0

  const TIMEFRAME_LABELS = {
    all: "All Time",
    today: "Today",
    week: "Last 7 Days",
    month: "Last 30 Days",
    custom: startDate && endDate ? `${startDate} to ${endDate}` : "Custom Range"
  }
  const rangeLabel = TIMEFRAME_LABELS[timeframe] ?? "All Time"

  return (
    <div className="space-y-8">
      {/* Timeframe Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-bold text-foreground/95">Report Timeframe:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="h-9 w-40 rounded-lg text-xs font-semibold animate-shimmer">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📁 All Time</SelectItem>
              <SelectItem value="today">⚡ Today</SelectItem>
              <SelectItem value="week">📅 Last 7 Days</SelectItem>
              <SelectItem value="month">🗓️ Last 30 Days</SelectItem>
              <SelectItem value="custom">⚙️ Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {timeframe === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs rounded-lg w-36 bg-background/30"
              />
              <span className="text-xs text-muted-foreground font-semibold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs rounded-lg w-36 bg-background/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Attention — org-wide, always-current; independent of the range filter below */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-warning" /> Needs Attention
        </h3>
        {healthReport.overdueTasks === 0 && overCapacityCount === 0 && patternCount === 0 ? (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border/40 bg-card/30">
            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
            <span className="text-sm text-muted-foreground font-medium">Nothing needs attention right now.</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {healthReport.overdueTasks > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab("employees")}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="text-sm font-bold">{healthReport.overdueTasks}</span>
                <span className="text-xs font-medium">{healthReport.overdueTasks === 1 ? "task overdue org-wide" : "tasks overdue org-wide"}</span>
              </button>
            )}
            {overCapacityCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab("employees")}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive transition-colors"
              >
                <Gauge className="h-4 w-4 shrink-0" />
                <span className="text-sm font-bold">{overCapacityCount}</span>
                <span className="text-xs font-medium">{overCapacityCount === 1 ? "employee over capacity today" : "employees over capacity today"}</span>
              </button>
            )}
            {patternCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveSubTab("employees")}
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-warning/30 bg-warning/5 hover:bg-warning/10 text-warning-foreground transition-colors"
              >
                <TrendingDown className="h-4 w-4 shrink-0" />
                <span className="text-sm font-bold">{patternCount}</span>
                <span className="text-xs font-medium">{patternCount === 1 ? "employee flagged for estimation pattern" : "employees flagged for estimation pattern"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Summary Cards */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Showing:</span>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
          {rangeLabel}
        </span>
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Org Tasks</CardTitle>
            <Briefcase className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{healthReport.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Active work items · {rangeLabel}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Org Completion Rate</CardTitle>
            <TrendingUp className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-green-400">{healthReport.avgCompletionRate}%</div>
            <div className="w-full bg-muted rounded-full h-1 mt-2">
              <div className="bg-green-500 h-full rounded-full" style={{ width: `${healthReport.avgCompletionRate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracked Time</CardTitle>
            <Clock className="h-4.5 w-4.5 text-violet-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-violet-400">{formatHours(healthReport.totalTrackedSeconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative time · {rangeLabel}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue Items</CardTitle>
            <AlertTriangle className={`h-4.5 w-4.5 ${healthReport.overdueTasks > 0 ? "text-amber-500 animate-bounce" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-400">{healthReport.overdueTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Past due · always current, not scoped to {rangeLabel.toLowerCase()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Report Container */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4 gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Multi-Dimensional Performance Report
            </CardTitle>
            <CardDescription>Track employee metrics, department efficiency, and productivity indicators.</CardDescription>
          </div>

          {/* Sub Navigation pills */}
          <div className="flex flex-wrap bg-muted/65 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
            <Button
              variant={activeSubTab === "employees" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("employees")}
            >
              Employees
            </Button>
            <Button
              variant={activeSubTab === "departments" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("departments")}
            >
              Departments
            </Button>
            <Button
              variant={activeSubTab === "teams" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("teams")}
            >
              Teams
            </Button>
            <Button
              variant={activeSubTab === "analytics" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("analytics")}
            >
              Analytics
            </Button>
            <Button
              variant={activeSubTab === "insights" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("insights")}
            >
              Insights
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {activeSubTab === "employees" && <EmployeesReport />}
          {activeSubTab === "departments" && <DepartmentsReport />}
          {activeSubTab === "teams" && <TeamsReport />}
          {activeSubTab === "analytics" && <AnalyticsReport />}
          {activeSubTab === "insights" && <InsightsReport />}
        </CardContent>
      </Card>

      <EmployeeDrilldownModal />
    </div>
  )
}

export default ReportsTab
