import { useState, useEffect, useRef } from "react"
import { useAuth } from "../../../context/AuthContext"
import { useTimer } from "../../../context/TimerContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ClipboardList, CheckCircle2, Clock, Plus, Kanban, List } from "lucide-react"
import { formatTime } from "../../../lib/taskFormatters"
import { useTaskStatusMutation } from "../../../hooks/useTaskStatusMutation"
import { useTaskMutation } from "../../../hooks/useTaskMutation"
import { useToast } from "../../../context/ToastContext"
import useEmployeeDashboardStore from "../../../store/useEmployeeDashboardStore"
import DailyTasksSection from "../employee/DailyTasksSection"
import MyProgressSection from "../employee/MyProgressSection"
import NeedsAttentionStrip from "../employee/NeedsAttentionStrip"
import TaskListView from "../employee/TaskListView"
import TaskKanbanBoard from "../employee/TaskKanbanBoard"
import CreateTaskModal from "../employee/CreateTaskModal"
import CancelTaskDialog from "../../tasks/CancelTaskDialog"
import EmployeeTaskDetailModal from "../../tasks/EmployeeTaskDetailModal"
import ScopeToggle from "../../tasks/ScopeToggle"
import { SCOPE_LABELS } from "../../../lib/taskScope"

// A person's own work — tasks, daily tasks, timer, capacity, progress. Every role
// (employee, manager, super_admin) can have their own work (see CLAUDE.md's
// management-hierarchy requirements: "employee" is a responsibility everyone carries,
// not a role only some users have). This is the exact content that used to live
// directly on EmployeeDashboard; it's now shared so a Manager/Admin's "My Work" tab
// gets the identical, already-battle-tested experience instead of a second copy.
const MyWorkPanel = () => {
  const { user } = useAuth()
  const userId = user?.id || user?._id
  const { activeSession, elapsedSeconds, isPending, refreshTimer } = useTimer()

  const tasks = useEmployeeDashboardStore(s => s.tasks)
  const setTasks = useEmployeeDashboardStore(s => s.setTasks)
  const todayHours = useEmployeeDashboardStore(s => s.todayHours)
  const loading = useEmployeeDashboardStore(s => s.loading)
  const loadTasks = useEmployeeDashboardStore(s => s.loadTasks)
  const provisionAndLoad = useEmployeeDashboardStore(s => s.provisionAndLoad)
  const loadMyReport = useEmployeeDashboardStore(s => s.loadMyReport)
  const scope = useEmployeeDashboardStore(s => s.scope)
  const setScope = useEmployeeDashboardStore(s => s.setScope)

  const [detailTask, setDetailTask] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [formMode, setFormMode] = useState("create")
  const [editTask, setEditTask] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [viewMode, setViewMode] = useState("board") // "board" | "list"
  const [transitionComment, setTransitionComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const toast = useToast()

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = searchQuery
      ? (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.priority?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    return matchesSearch
  })

  // One-time setup on mount: provision today's daily tasks, then load the list.
  // Personal progress is loaded separately, non-blocking, alongside it. `userId` is
  // passed through so this narrows to "my own work" when reused by a manager/admin.
  useEffect(() => {
    provisionAndLoad(userId)
    loadMyReport(userId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh the task list exactly once per timer action, when it actually settles —
  // not on every intermediate state change (TimerContext does an optimistic update
  // followed by the real one, so `activeSession` changes twice per click).
  const skipFirstPendingRun = useRef(true)
  useEffect(() => {
    if (skipFirstPendingRun.current) {
      skipFirstPendingRun.current = false
      return
    }
    if (!isPending) {
      loadTasks(userId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending])

  // The open dialog always shows the freshest copy of its task.
  //
  // This used to be an effect that wrote `detailTask` back into state whenever `tasks`
  // changed — a cascading render on every list refresh, and every timer tick that
  // reloaded the list. Deriving it instead means there is nothing to keep in sync:
  // `tasks` is the single source of truth and the dialog reads through to it.
  //
  // `detailTask` remains state because it records WHICH task is open (and the mutation
  // hooks patch it optimistically); only the rendered value is derived. Falling back to
  // the stored copy keeps the dialog usable for a task that has dropped out of the list,
  // e.g. after a scope change.
  const openDetailTask = detailTask
    ? (tasks.find(t => t._id === detailTask._id) ?? detailTask)
    : null

  // ─── Optimistic Status Transition ─────────────────────────────────────────
  // Mirrors the optimistic pattern already used for the timer; additionally syncs the
  // timer if the changed task is the active session task (via onSuccess below).
  const { updateStatus: runStatusTransition } = useTaskStatusMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting,
    onSuccess: async (taskId) => {
      if (activeSession && activeSession.task?._id === taskId && typeof refreshTimer === "function") {
        await refreshTimer()
      }
    }
  })

  // Blocked is the one mutation someone has on any task assigned to them — being
  // stuck is theirs to report (see BlockedPanel).
  const { setBlocked, patchTask, cancelTask } = useTaskMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  // A person may edit and cancel tasks they created themselves — the backend has
  // always allowed this (EMPLOYEE_EDITABLE_FIELDS); it just had no UI.
  const openCreate = () => { setFormMode("create"); setEditTask(null); setCreateOpen(true) }
  const openEdit = (task) => { setFormMode("edit"); setEditTask(task); setCreateOpen(true) }
  const handleSaveEdit = (fields) => patchTask(editTask._id, fields)
  const handleCancelConfirm = async (taskId, reason) => {
    const result = await cancelTask(taskId, reason)
    if (result.success) toast.success("Task cancelled.")
    return result
  }

  // Only self-created, not-yet-completed tasks are editable; cancelling is further
  // limited to work that hasn't started (the server enforces both).
  const buildTaskActions = (task) => {
    const selfCreated = (task.assignedBy?._id || task.assignedBy) === (task.assignedTo?._id || task.assignedTo)
    return {
      onView: setDetailTask,
      onToggleBlocked: handleToggleBlocked,
      ...(selfCreated && { onEdit: openEdit }),
      ...(selfCreated && task.status === "Not Started" && { onCancel: setCancelTarget })
    }
  }

  const handleToggleBlocked = async (task, isBlocked, reason) => {
    const result = await setBlocked(task._id, isBlocked, reason)
    if (result.success) {
      toast.success(isBlocked ? "Marked as blocked — your manager can see it." : "Task unblocked.")
    }
    return result
  }

  const handleStatusTransition = async (newStatus, taskId = null) => {
    const targetTaskId = taskId || detailTask?._id
    if (!targetTaskId) return
    const result = await runStatusTransition(targetTaskId, newStatus, transitionComment)
    if (result.success) {
      setTransitionComment("")
    }
  }

  // Metrics
  const completedCount = tasks.filter(t => t.status === "Completed").length

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-52" />
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
              <div className="grid grid-cols-5 gap-4 pb-2 border-b border-border/50">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-3" />)}
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 py-2">
                  {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-4" />)}
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
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            My Workspace
          </h2>
          <p className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{user?.name}</strong>. Start timers on your assigned tasks, record log hours, and submit work reviews.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" /> Create Task
        </Button>
      </div>

      {/* Needs Attention — overdue / over-estimate tasks, links down into My Tasks */}
      <NeedsAttentionStrip />

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{SCOPE_LABELS[scope]}'s Tasks</CardTitle>
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {scope === "all" ? "Every task ever assigned to you" : `In scope for ${SCOPE_LABELS[scope].toLowerCase()}`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Work Session</CardTitle>
            <Clock className={`h-4.5 w-4.5 ${activeSession ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
              {activeSession ? formatTime(elapsedSeconds) : "00:00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {activeSession ? `Active: ${activeSession.task?.title}` : "No active timer"}
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
            <p className="text-xs text-muted-foreground mt-1">
              {scope === "all" ? "All-time · marked completed or approved" : `Completed within ${SCOPE_LABELS[scope].toLowerCase()}`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-info rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Tracked Time</CardTitle>
            <Clock className="h-4.5 w-4.5 text-info animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-info">{todayHours}h</div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative time recorded today</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Tasks Section */}
      <DailyTasksSection setDetailTask={setDetailTask} />

      {/* Task List */}
      <Card id="my-tasks-section" className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">My Assigned Tasks</CardTitle>
            <CardDescription>
              {scope === "all" ? "Every task assigned to you" : `Showing ${SCOPE_LABELS[scope].toLowerCase()} — overdue work always stays visible`}
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <Input
              placeholder="🔍 Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background/50 border-border/40 max-w-[200px]"
            />
            <ScopeToggle scope={scope} onChange={(s) => setScope(s, userId)} />

            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/40 shrink-0">
              <Button
                variant={viewMode === "board" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 rounded-md text-[11px] gap-1.5 font-semibold ${
                  viewMode === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("board")}
              >
                <Kanban className="h-3 w-3" />
                Board
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 rounded-md text-[11px] gap-1.5 font-semibold ${
                  viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List className="h-3 w-3" />
                List
              </Button>
            </div>

            <Badge variant="outline" className="h-6 font-mono rounded-lg">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <TaskListView
              filteredTasks={filteredTasks}
              loading={loading}
              searchQuery={searchQuery}
              setDetailTask={setDetailTask}
              handleStatusTransition={handleStatusTransition}
              buildTaskActions={buildTaskActions}
              submitting={submitting}
            />
          ) : (
            <TaskKanbanBoard
              filteredTasks={filteredTasks}
              setDetailTask={setDetailTask}
              handleStatusTransition={handleStatusTransition}
              buildTaskActions={buildTaskActions}
              submitting={submitting}
            />
          )}
        </CardContent>
      </Card>

      {/* My Progress — personal history, all-time, visible only to this person */}
      <MyProgressSection />

      {/* Create Task Modal */}
      <CreateTaskModal
        createOpen={createOpen}
        setCreateOpen={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        mode={formMode}
        editTask={editTask}
        onSave={handleSaveEdit}
      />

      <CancelTaskDialog
        key={cancelTarget?._id}
        task={cancelTarget}
        open={cancelTarget !== null}
        onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
        onConfirm={handleCancelConfirm}
        submitting={submitting}
      />

      {/* Task Detail Modal */}
      <EmployeeTaskDetailModal
        detailTask={openDetailTask}
        setDetailTask={setDetailTask}
        handleStatusTransition={handleStatusTransition}
        submitting={submitting}
        onCommentPosted={() => loadTasks(userId)}
        onToggleBlocked={handleToggleBlocked}
      />
    </div>
  )
}

export default MyWorkPanel
