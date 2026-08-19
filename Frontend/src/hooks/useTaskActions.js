import { useState } from "react"
import { useTaskMutation } from "./useTaskMutation"
import { emptyTaskForm, taskToForm } from "../lib/taskFormState"
import { CATEGORY_PRESETS } from "../lib/taskConstants"
import { getTomorrowDateString, formatDayLabel } from "../lib/taskHelpers"
import { useToast } from "../context/ToastContext"
import useManagerDashboardStore from "../store/useManagerDashboardStore"
import useCalendarStore from "../store/useCalendarStore"

// All manager/admin task-mutation wiring in one place: create, edit, reassign,
// reschedule, cancel — the dialog state, the handlers, and the `taskActions` bundle
// that every task surface spreads onto TaskActionMenu.
//
// Extracted because two shells need the identical set (TeamCommandCenter and
// TeamTasksPage). Duplicating it would be exactly the copy-paste drift decisions.md §6
// calls out — a fix applied to one and missed in the other.
//
// `submitting`/`setSubmitting` are passed in rather than owned here so they stay the
// same shared flag the shell's useTaskStatusMutation uses, matching existing behaviour.
export function useTaskActions({ tasks, setTasks, detailTask, setDetailTask, submitting, setSubmitting }) {
  const employees = useManagerDashboardStore(s => s.employees)
  const calendar = useCalendarStore(s => s.calendar)
  const toast = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [taskForm, setTaskForm] = useState(emptyTaskForm())
  const [formMode, setFormMode] = useState("create")
  const [editTask, setEditTask] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [reassignTarget, setReassignTarget] = useState(null)
  const [customCategoryActive, setCustomCategoryActive] = useState(false)

  const { patchTask, cancelTask, setBlocked } = useTaskMutation({
    tasks, setTasks, detailTask, setDetailTask, setSubmitting
  })

  // Reassignment sends an id, but task objects hold a populated ref — the optimistic
  // patch needs the display shape or `assignedTo.name` renders break until the
  // response lands.
  const assigneeDisplay = (id, fallback) => employees.find(e => e._id === id) || fallback

  const openCreate = () => {
    setFormMode("create")
    setEditTask(null)
    setTaskForm(emptyTaskForm())
    setCustomCategoryActive(false)
    setCreateOpen(true)
  }

  const openCreateForEmployee = (employeeId) => {
    setFormMode("create")
    setEditTask(null)
    setTaskForm({ ...emptyTaskForm(), assignedTo: employeeId })
    setCustomCategoryActive(false)
    setCreateOpen(true)
  }

  const openEdit = (task) => {
    setFormMode("edit")
    setEditTask(task)
    setTaskForm(taskToForm(task))
    // A category outside the preset list is a custom one — keep the text input open
    // so the existing value stays visible and editable.
    setCustomCategoryActive(!CATEGORY_PRESETS.includes(task.category))
    setCreateOpen(true)
  }

  const handleSaveEdit = (fields) => patchTask(editTask._id, fields, {
    optimistic: { ...fields, assignedTo: assigneeDisplay(fields.assignedTo, editTask.assignedTo) }
  })

  const handleMoveToTomorrow = async (task) => {
    // Next WORKING day — rescheduling onto a Saturday isn't a real reschedule.
    const tomorrow = getTomorrowDateString(new Date(), calendar)
    const result = await patchTask(task._id, { dueDate: tomorrow })
    if (result.success) toast.success(`“${task.title}” moved to ${formatDayLabel(tomorrow)}.`)
    return result
  }

  const handleReassignConfirm = async (task, newAssigneeId) => {
    const result = await patchTask(task._id, { assignedTo: newAssigneeId }, {
      optimistic: { assignedTo: assigneeDisplay(newAssigneeId, task.assignedTo) }
    })
    if (result.success) {
      toast.success(`“${task.title}” reassigned to ${assigneeDisplay(newAssigneeId)?.name || "another team member"}.`)
    }
    return result
  }

  const handleToggleBlocked = async (task, isBlocked, reason) => {
    const result = await setBlocked(task._id, isBlocked, reason)
    if (result.success) {
      toast.success(isBlocked ? `“${task.title}” marked blocked.` : `“${task.title}” unblocked.`)
    }
    return result
  }

  const handleCancelConfirm = async (taskId, reason) => {
    const result = await cancelTask(taskId, reason)
    if (result.success) toast.success("Task cancelled.")
    return result
  }

  // Spread onto <TaskActionMenu task={t} {...taskActions} /> on any surface.
  const taskActions = {
    onView: setDetailTask,
    onEdit: openEdit,
    onReassign: setReassignTarget,
    onMoveToTomorrow: handleMoveToTomorrow,
    onToggleBlocked: handleToggleBlocked,
    onCancel: setCancelTarget
  }

  // Spread onto <TaskActionDialogs {...dialogProps} /> once per shell.
  const dialogProps = {
    createOpen, setCreateOpen,
    taskForm, setTaskForm,
    customCategoryActive, setCustomCategoryActive,
    submitting, setSubmitting,
    formMode, editTask,
    onSave: handleSaveEdit,
    cancelTarget, setCancelTarget, onCancelConfirm: handleCancelConfirm,
    reassignTarget, setReassignTarget, onReassignConfirm: handleReassignConfirm
  }

  return { taskActions, dialogProps, openCreate, openCreateForEmployee, openEdit, handleToggleBlocked }
}
