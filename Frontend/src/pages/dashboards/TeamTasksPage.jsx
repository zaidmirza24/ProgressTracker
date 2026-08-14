import { useState, useEffect } from "react"
import { useAuth } from "../../context/AuthContext"
import { useTaskStatusMutation } from "../../hooks/useTaskStatusMutation"
import useManagerDashboardStore from "../../store/useManagerDashboardStore"
import TeamTasksTable from "../../components/dashboards/manager/TeamTasksTable"
import ManagerTaskDetailModal from "../../components/tasks/ManagerTaskDetailModal"
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

  const [detailTask, setDetailTask] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const { updateStatus: updateTaskStatus } = useTaskStatusMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  useEffect(() => {
    loadData(userId, user?.role)
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
      />

      <ManagerTaskDetailModal
        detailTask={detailTask}
        setDetailTask={setDetailTask}
        updateTaskStatus={updateTaskStatus}
        submitting={submitting}
        onCommentPosted={() => loadData(userId, user?.role)}
      />
    </div>
  )
}

export default TeamTasksPage
