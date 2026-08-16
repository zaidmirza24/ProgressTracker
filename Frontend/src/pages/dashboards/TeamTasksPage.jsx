import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { useTaskStatusMutation } from "../../hooks/useTaskStatusMutation"
import { useTaskActions } from "../../hooks/useTaskActions"
import useManagerDashboardStore from "../../store/useManagerDashboardStore"
import useCalendarStore from "../../store/useCalendarStore"
import TeamTasksTable from "../../components/dashboards/manager/TeamTasksTable"
import ManagerTaskDetailModal from "../../components/tasks/ManagerTaskDetailModal"
import TaskActionDialogs from "../../components/tasks/TaskActionDialogs"
import { ClipboardList } from "lucide-react"

// Own page (was embedded in Manager/Admin's Overview) — reachable from the sidebar for
// both roles. Reuses the same store/mutation pattern as TeamCommandCenter, just scoped
// down to only what TeamTasksTable + its detail modal need.
const TeamTasksPage = () => {
  const { user } = useAuth()
  const userId = user?.id || user?._id

  const tasks = useManagerDashboardStore(s => s.tasks)
  const setTasks = useManagerDashboardStore(s => s.setTasks)
  const loading = useManagerDashboardStore(s => s.loading)
  const loadData = useManagerDashboardStore(s => s.loadData)
  const fetchCalendar = useCalendarStore(s => s.fetchContext)

  const [detailTask, setDetailTask] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { updateStatus: updateTaskStatus } = useTaskStatusMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  // Same action set as the Overview page — shared via the hook so the two can't drift.
  const { taskActions, dialogProps, handleToggleBlocked } = useTaskActions({
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" />
          Team Tasks Tracker
        </h2>
        <p className="text-muted-foreground">Overall tracking of work assigned to employees.</p>
      </div>

      <TeamTasksTable
        updateTaskStatus={updateTaskStatus}
        setDetailTask={setDetailTask}
        loading={loading}
        taskActions={taskActions}
        submitting={submitting}
      />

      <TaskActionDialogs user={user} {...dialogProps} />

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
    </div>
  )
}

export default TeamTasksPage
