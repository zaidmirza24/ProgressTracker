import axios from "axios"
import API_BASE from "../lib/api"

// Field edits (PATCH) and cancellation (soft-delete DELETE), sharing the exact
// optimistic pattern useTaskStatusMutation established: patch the tasks array
// immediately, reconcile with the server response, roll back on failure.
//
// Why optimistic matters here specifically: capacity bars, the Attention Zone counts,
// and the capacity forecast are all derived client-side from this same `tasks` array
// (see lib/taskHelpers.js). Patching it locally makes every one of those recalculate
// in the same frame — no refetch needed.
//
// Errors are deliberately NOT toasted here. The global axios interceptor in
// ToastContext already surfaces every non-401 error, and the backend's AppError
// messages are written to be read by users — toasting again would double up.
// Callers get the machine-readable `code` back so they can branch (e.g. TASK_MODIFIED).
export function useTaskMutation({ tasks, setTasks, detailTask, setDetailTask, setSubmitting, onSuccess }) {
  const applyDetail = (updater) => {
    if (typeof setDetailTask === "function") setDetailTask(updater)
  }

  /**
   * @param {string} taskId
   * @param {object} fields   - Values sent to the API (raw IDs for assignedTo/department)
   * @param {object} [opts]
   * @param {string} [opts.comment]     - Optional note attached to the audit entry
   * @param {object} [opts.optimistic]  - Display-shaped override for the local patch.
   *   Needed when a field is populated in the task object but sent as an ID — e.g.
   *   reassignment sends `{ assignedTo: "<id>" }` but must patch `{ assignedTo: { _id, name } }`
   *   locally, or every `t.assignedTo?.name` render would break until the response lands.
   */
  const patchTask = async (taskId, fields, { comment, optimistic } = {}) => {
    const prevTasks = tasks
    const prevDetailTask = detailTask
    const current = tasks.find(t => t._id === taskId)

    const localFields = optimistic || fields
    const optimisticPatch = (t) => (t._id === taskId ? { ...t, ...localFields } : t)

    setTasks(prev => prev.map(optimisticPatch))
    if (detailTask && detailTask._id === taskId) applyDetail(optimisticPatch(detailTask))
    setSubmitting(true)

    try {
      const res = await axios.patch(`${API_BASE}/api/tasks/${taskId}`, {
        ...fields,
        ...(comment && { comment }),
        // Optimistic concurrency — the server rejects the write if someone else
        // changed the task since this copy was loaded.
        updatedAt: current?.updatedAt
      })
      setTasks(prev => prev.map(t => (t._id === taskId ? res.data.task : t)))
      if (detailTask && detailTask._id === taskId) applyDetail(res.data.task)
      if (onSuccess) await onSuccess(taskId, res.data.task)
      return { success: true, task: res.data.task, warning: res.data.warning }
    } catch (err) {
      setTasks(prevTasks)
      applyDetail(prevDetailTask)
      console.error("Error updating task:", err)
      return { success: false, code: err.response?.data?.code }
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Soft-delete. The task drops out of the local array immediately; the server keeps
   * the document (isActive: false) along with its work sessions and audit trail.
   */
  const cancelTask = async (taskId, reason) => {
    const prevTasks = tasks
    const prevDetailTask = detailTask

    setTasks(prev => prev.filter(t => t._id !== taskId))
    if (detailTask && detailTask._id === taskId) applyDetail(null)
    setSubmitting(true)

    try {
      // DELETE carries the reason in the body — axios needs `data` for that.
      await axios.delete(`${API_BASE}/api/tasks/${taskId}`, { data: { reason } })
      if (onSuccess) await onSuccess(taskId, null)
      return { success: true }
    } catch (err) {
      setTasks(prevTasks)
      applyDetail(prevDetailTask)
      console.error("Error cancelling task:", err)
      return { success: false, code: err.response?.data?.code }
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Toggle the blocked flag. Separate endpoint from patchTask because the assignee is
   * allowed to block their own task even when they can't edit its other fields.
   */
  const setBlocked = async (taskId, isBlocked, reason) => {
    const prevTasks = tasks
    const prevDetailTask = detailTask

    const optimisticPatch = (t) => (t._id === taskId
      ? { ...t, isBlocked, blockedReason: isBlocked ? reason : "", blockedAt: isBlocked ? new Date().toISOString() : null }
      : t)

    setTasks(prev => prev.map(optimisticPatch))
    if (detailTask && detailTask._id === taskId) applyDetail(optimisticPatch(detailTask))
    setSubmitting(true)

    try {
      const res = await axios.patch(`${API_BASE}/api/tasks/${taskId}/blocked`, { isBlocked, reason })
      setTasks(prev => prev.map(t => (t._id === taskId ? res.data.task : t)))
      if (detailTask && detailTask._id === taskId) applyDetail(res.data.task)
      if (onSuccess) await onSuccess(taskId, res.data.task)
      return { success: true, task: res.data.task }
    } catch (err) {
      setTasks(prevTasks)
      applyDetail(prevDetailTask)
      console.error("Error updating blocked state:", err)
      return { success: false, code: err.response?.data?.code }
    } finally {
      setSubmitting(false)
    }
  }

  return { patchTask, cancelTask, setBlocked }
}
