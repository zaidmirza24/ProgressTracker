import { useState, useEffect } from "react"
import { useAuth } from "../../../context/AuthContext"
import { useTaskStatusMutation } from "../../../hooks/useTaskStatusMutation"
import { useTaskActions } from "../../../hooks/useTaskActions"
import useManagerDashboardStore from "../../../store/useManagerDashboardStore"
import useCalendarStore from "../../../store/useCalendarStore"
import AttentionZone from "../manager/AttentionZone"
import ActiveWorkStrip from "../manager/ActiveWorkStrip"
import PendingReviewQueue from "../manager/PendingReviewQueue"
import TeamWorkloadTracker from "../manager/TeamWorkloadTracker"
import TeamCapacityForecast from "../manager/TeamCapacityForecast"
import TeamSignalsPanel from "../manager/TeamSignalsPanel"
import TaskActionDialogs from "../../tasks/TaskActionDialogs"
import ManagerTaskDetailModal from "../../tasks/ManagerTaskDetailModal"
import WorkLogsSection from "../manager/WorkLogsSection"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, CheckCircle2, Clock, Plus, UserCheck, LayoutDashboard } from "lucide-react"

// Task review + workload/capacity/signals + work logs, shared verbatim by Manager
// (whole page) and Super Admin (default tab) — both roles get identical power here,
// scoped by useManagerDashboardStore's loadData(userId, role): a manager sees their
// own direct reports, super_admin sees everyone org-wide. No props required — reads
// the logged-in user itself, so it drops into either dashboard unchanged.
const TeamCommandCenter = () => {
  const { user } = useAuth()
  const userId = user?.id || user?._id

  const tasks = useManagerDashboardStore(s => s.tasks)
  const setTasks = useManagerDashboardStore(s => s.setTasks)
  const loading = useManagerDashboardStore(s => s.loading)
  const loadData = useManagerDashboardStore(s => s.loadData)
  const fetchCalendar = useCalendarStore(s => s.fetchContext)

  const [detailTask, setDetailTask] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // ─── Optimistic Status Update ──────────────────────────────────────────────
  // Shared by every review/status action across PendingReviewQueue, TeamTasksTable,
  // and TaskDetailModal so a click doesn't wait on a full loadData() (tasks + users
  // + depts + logs).
  const { updateStatus: updateTaskStatus } = useTaskStatusMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  // ─── Task Actions (create/edit/reassign/reschedule/cancel) ─────────────────
  // Shared with TeamTasksPage via the hook, so both surfaces stay in step.
  // Patching the tasks array optimistically is what makes capacity bars, the
  // Attention Zone counts, and the forecast recalculate in the same frame.
  const { taskActions, dialogProps, openCreate, openCreateForEmployee, handleToggleBlocked } = useTaskActions({
    tasks, setTasks, detailTask, setDetailTask, submitting, setSubmitting
  })

  useEffect(() => {
    loadData(userId, user?.role)
    // Working days, holidays and absences — every capacity number on this page is
    // computed against them. Fetched in parallel; capacity falls back to "every day
    // is a working day" until it lands.
    fetchCalendar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Metrics
  const pendingReviewCount = tasks.filter(t => t.status === "In Review").length
  const inProgressCount = tasks.filter(t => t.status === "In Progress").length
  const pendingCount = tasks.filter(t => t.status === "Pending").length
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
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            Task Command Center
          </h3>
          <p className="text-sm text-muted-foreground">Review submissions, track workload, and assign tasks.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" /> Create Task
        </Button>
      </div>

      {/* Needs Your Attention — live summary, links down into the sections below */}
      <AttentionZone />

      {/* Who's actively tracking time right now — distinct from a status count */}
      <ActiveWorkStrip />

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
            <p className="text-xs text-muted-foreground mt-1">All-time · total assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</CardTitle>
            <UserCheck className={`h-4.5 w-4.5 ${pendingReviewCount > 0 ? "text-warning animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-warning">{pendingReviewCount}</div>
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
            <p className="text-xs text-muted-foreground mt-1">
              Actively tracked{pendingCount > 0 ? ` · ${pendingCount} paused` : ""}
            </p>
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
            <p className="text-xs text-muted-foreground mt-1">All-time · approved and locked work items</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Review Queue */}
      <div id="pending-review-section">
        <PendingReviewQueue
          updateTaskStatus={updateTaskStatus}
          submitting={submitting}
          setDetailTask={setDetailTask}
          taskActions={taskActions}
        />
      </div>

      {/* Employee-wise Workload Tracker */}
      <div id="team-workload-section">
        <TeamWorkloadTracker
          openCreateForEmployee={openCreateForEmployee}
          setDetailTask={setDetailTask}
          taskActions={taskActions}
          submitting={submitting}
        />
      </div>

      {/* Employee Signal Summary — Iterations 7-10's signals, wired per-employee */}
      <div id="team-signals-section">
        <TeamSignalsPanel />
      </div>

      {/* Team Capacity Forecast (V2 preview) */}
      <TeamCapacityForecast />

      {/* Create / Edit, Cancel, and Reassign dialogs */}
      <TaskActionDialogs user={user} {...dialogProps} />

      {/* Task Detail & Approval Modal */}
      <ManagerTaskDetailModal
        detailTask={detailTask}
        setDetailTask={setDetailTask}
        updateTaskStatus={updateTaskStatus}
        submitting={submitting}
        onCommentPosted={() => loadData(userId, user?.role)}
        onEdit={(task) => { setDetailTask(null); taskActions.onEdit(task) }}
        onCancel={(task) => { setDetailTask(null); taskActions.onCancel(task) }}
        onToggleBlocked={handleToggleBlocked}
      />

      {/* Work Logs Section */}
      <WorkLogsSection />
    </div>
  )
}

export default TeamCommandCenter
