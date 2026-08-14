import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { getLocalDateString } from "../../lib/taskFormatters"
import { useTaskStatusMutation } from "../../hooks/useTaskStatusMutation"
import useManagerDashboardStore from "../../store/useManagerDashboardStore"
import PendingReviewQueue from "../../components/dashboards/manager/PendingReviewQueue"
import TeamWorkloadTracker from "../../components/dashboards/manager/TeamWorkloadTracker"
import TeamCapacityForecast from "../../components/dashboards/manager/TeamCapacityForecast"
import TeamSignalsPanel from "../../components/dashboards/manager/TeamSignalsPanel"
import TeamTasksTable from "../../components/dashboards/manager/TeamTasksTable"
import CreateTaskModal from "../../components/dashboards/manager/CreateTaskModal"
import TaskDetailModal from "../../components/tasks/TaskDetailModal"
import WorkLogsSection from "../../components/dashboards/manager/WorkLogsSection"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, CheckCircle2, Clock, Plus, UserCheck } from "lucide-react"

const ManagerDashboard = () => {
  const { user } = useAuth()
  const managerId = user?.id || user?._id

  const tasks = useManagerDashboardStore(s => s.tasks)
  const setTasks = useManagerDashboardStore(s => s.setTasks)
  const loading = useManagerDashboardStore(s => s.loading)
  const loadData = useManagerDashboardStore(s => s.loadData)

  const [createOpen, setCreateOpen] = useState(false)
  const [detailTask, setDetailTask] = useState(null)

  // Forms
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "General",
    department: "", assignedTo: "", priority: "medium",
    estimatedHours: 0, dueDate: getLocalDateString()
  })
  const [customCategoryActive, setCustomCategoryActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ─── Optimistic Status Update ──────────────────────────────────────────────
  // Shared by every review/status action across PendingReviewQueue, TeamTasksTable,
  // and TaskDetailModal so a click doesn't wait on a full loadData() (tasks + users
  // + depts + logs).
  const { updateStatus: updateTaskStatus } = useTaskStatusMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  useEffect(() => {
    loadData(managerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreateForEmployee = (employeeId) => {
    setTaskForm({
      title: "", description: "", category: "General",
      department: "", assignedTo: employeeId, priority: "medium",
      estimatedHours: 0, dueDate: getLocalDateString()
    })
    setCustomCategoryActive(false)
    setCreateOpen(true)
  }

  // Metrics
  const pendingReviewCount = tasks.filter(t => t.status === "In Review").length
  const inProgressCount = tasks.filter(t => ["In Progress", "Pending"].includes(t.status)).length
  const completedCount = tasks.filter(t => t.status === "Completed").length

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32 self-start sm:self-auto" />
        </div>

        {/* Metric cards skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card className="border-border/50">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-4 pb-2 border-b border-border/50">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-3" />)}
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 py-2">
                  {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-4" />)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Manager Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{user?.name}</strong>. Monitor team progress, assign tasks, and review submissions.
          </p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setCustomCategoryActive(false); }} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" /> Create Task
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Tasks</CardTitle>
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</CardTitle>
            <UserCheck className={`h-4.5 w-4.5 ${pendingReviewCount > 0 ? "text-warning animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-warning-foreground">{pendingReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires approval review</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Progress</CardTitle>
            <Clock className="h-4.5 w-4.5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks actively tracked</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Approved and locked work items</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Review Queue */}
      <PendingReviewQueue
        updateTaskStatus={updateTaskStatus}
        submitting={submitting}
        setDetailTask={setDetailTask}
      />

      {/* Employee-wise Workload Tracker */}
      <TeamWorkloadTracker
        openCreateForEmployee={openCreateForEmployee}
        setDetailTask={setDetailTask}
      />

      {/* Employee Signal Summary — Iterations 7-10's signals, wired per-employee */}
      <TeamSignalsPanel />

      {/* Team Capacity Forecast (V2 preview) */}
      <TeamCapacityForecast />

      {/* Task List */}
      <TeamTasksTable
        updateTaskStatus={updateTaskStatus}
        setDetailTask={setDetailTask}
        loading={loading}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        taskForm={taskForm}
        setTaskForm={setTaskForm}
        customCategoryActive={customCategoryActive}
        setCustomCategoryActive={setCustomCategoryActive}
        submitting={submitting}
        setSubmitting={setSubmitting}
        user={user}
      />

      {/* Task Detail & Approval Modal */}
      <TaskDetailModal
        role="manager"
        detailTask={detailTask}
        setDetailTask={setDetailTask}
        updateTaskStatus={updateTaskStatus}
        submitting={submitting}
        onCommentPosted={() => loadData(managerId)}
      />

      {/* Work Logs Section */}
      <WorkLogsSection />
    </div>
  )
}

export default ManagerDashboard
