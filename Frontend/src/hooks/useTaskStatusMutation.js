import axios from "axios"
import API_BASE from "../lib/api"
import { PROGRESS_FOR_STATUS } from "../lib/taskConstants"

// Shared optimistic status-update pattern: patches `tasks`/`detailTask` immediately,
// PUTs the change, reconciles with the server response, and rolls back on failure.
// `onSuccess(taskId, task)` lets callers hook in side effects (e.g. Employee's timer refresh)
// without the mutation itself branching on role.
export function useTaskStatusMutation({ tasks, setTasks, detailTask, setDetailTask, setSubmitting, onSuccess }) {
  const updateStatus = async (taskId, status, comment) => {
    const prevTasks = tasks
    const prevDetailTask = detailTask
    const optimisticPatch = (t) => t._id === taskId
      ? { ...t, status, progressPercentage: PROGRESS_FOR_STATUS[status] ?? t.progressPercentage }
      : t

    setTasks(prev => prev.map(optimisticPatch))
    if (detailTask && detailTask._id === taskId) {
      setDetailTask(optimisticPatch(detailTask))
    }
    setSubmitting(true)

    try {
      const res = await axios.put(`${API_BASE}/api/tasks/${taskId}/status`, { status, comment })
      setTasks(prev => prev.map(t => t._id === taskId ? res.data.task : t))
      if (detailTask && detailTask._id === taskId) {
        setDetailTask(res.data.task)
      }
      if (onSuccess) {
        await onSuccess(taskId, res.data.task)
      }
      return { success: true, task: res.data.task }
    } catch (err) {
      setTasks(prevTasks)
      setDetailTask(prevDetailTask)
      console.error("Error updating task status:", err)
      return { success: false }
    } finally {
      setSubmitting(false)
    }
  }

  return { updateStatus }
}
