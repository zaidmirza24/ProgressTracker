import mongoose from "mongoose"
import Task from "../models/Task.js"
import User from "../models/User.js"
import Department from "../models/Department.js"
import WorkSession from "../models/WorkSession.js"
import { isValidTransition, TASK_STATUSES } from "../config/workflow.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { runInTransaction } from "../utils/transaction.js"
import { provisionDailyTasksForEmployee } from "../services/dailyTaskService.js"
import {
  calculateSessionElapsedSeconds,
  stopRunningSessionForTask,
  startSessionForTask
} from "../services/taskService.js"
import {
  getOrgSettings,
  getAbsencesInRange,
  getCapacityForDay,
  isSameCalendarDay
} from "../services/calendarService.js"
import { buildScopeFilter, TASK_SCOPES } from "../services/taskScopeService.js"
import {
  computeOverrunFields,
  getReworkCount,
  wasEverReviewed,
  getLastReworkFeedback,
  getBlockedAgeDays,
  getProgressForStatus,
  PATTERN_LOOKBACK,
  PATTERN_MIN_SAMPLE,
  PATTERN_THRESHOLD,
  QUALITY_MIN_SAMPLE,
  QUALITY_THRESHOLD
} from "../services/taskMetrics.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

// PERFORMANCE FIX: Batch-aggregate tracked seconds for multiple tasks in one DB query
const attachTrackedSecondsToTasks = async (taskObjects) => {
  const taskIds = taskObjects.map(t => t._id)

  // Sum completed sessions per task
  const sessionAgg = await WorkSession.aggregate([
    { $match: { task: { $in: taskIds }, stoppedAt: { $ne: null } } },
    { $group: { _id: "$task", totalStopped: { $sum: "$totalSeconds" } } }
  ])

  // Find active (unstoppped) sessions
  const activeSessions = await WorkSession.find({ task: { $in: taskIds }, stoppedAt: null })

  // Build lookup maps
  const stoppedMap = {}
  sessionAgg.forEach(s => { stoppedMap[s._id.toString()] = s.totalStopped })

  const activeMap = {}
  activeSessions.forEach(s => { activeMap[s.task.toString()] = calculateSessionElapsedSeconds(s) })

  return taskObjects.map(t => {
    const id = t._id.toString()
    const totalTrackedSeconds = (stoppedMap[id] || 0) + (activeMap[id] || 0)

    // `history` and `comments` are UNBOUNDED — they grow for as long as a task is worked
    // on — and shipping them on every row is what made a manager's task list 54.9MB and
    // 15.6 seconds after two years of use (tests/perf/budgets.test.js). They are summarised
    // here and served in full by GET /api/tasks/:id, which is the only place that renders
    // them.
    const { history, comments, ...rest } = t
    const lastComment = comments?.length ? comments[comments.length - 1] : null

    return {
      ...rest,
      totalTrackedSeconds,
      // Still derived from the history that was loaded — the saving is in what is SENT,
      // not in what is read, so no extra query is needed and no signal is lost.
      reworkCount: getReworkCount(t),
      historyCount: history?.length ?? 0,
      commentCount: comments?.length ?? 0,
      // The review queue shows the latest note inline; that one entry is worth its bytes.
      lastComment: lastComment ? { text: lastComment.text, createdAt: lastComment.createdAt } : null,
      ...computeOverrunFields(t.estimatedHours, totalTrackedSeconds)
    }
  })
}

// Attach tracked time to a single task (still needed for status update / add comment responses)
const getTaskWithTime = async (task) => {
  const sessions = await WorkSession.find({ task: task._id })
  let totalTrackedSeconds = 0
  for (const s of sessions) {
    totalTrackedSeconds += s.stoppedAt ? s.totalSeconds : calculateSessionElapsedSeconds(s)
  }
  const tObj = task.toObject ? task.toObject() : task
  tObj.totalTrackedSeconds = totalTrackedSeconds
  tObj.reworkCount = getReworkCount(tObj)
  Object.assign(tObj, computeOverrunFields(tObj.estimatedHours, totalTrackedSeconds))
  return tObj
}

// Task-metric derivations (overrun, rework, blocked age, progress mapping, and the
// pattern/quality thresholds) live in services/taskMetrics.js — they are pure
// functions of their arguments and are imported at the top of this file.

// Persist a mutated task, refusing the write if someone else changed it first.
//
// The `updatedAt` comparison used to be read-compare-write in JavaScript: load the task,
// compare versions, mutate, save. That correctly rejects a STALE write (a browser tab
// left open, where the requests are sequential) but does nothing about two SIMULTANEOUS
// writes — both read the same version, both pass the check, both save, and one edit is
// silently lost, which is precisely what the check exists to prevent (§29).
//
// Pushing the comparison into the update filter makes MongoDB perform the
// compare-and-swap atomically: the second writer matches no document and is told.
//
// `$getChanges()` yields the same delta `save()` would have issued, including the
// `$push` onto history, so the mutation code above is unchanged. Callers that send no
// `updatedAt` keep the previous unconditional behaviour.
//
// Thrown (never surfaced to the client directly) to abort an in-progress transaction
// when the optimistic-concurrency check fails partway through it — see updateTaskStatus.
class VersionConflict extends Error {}

// @param {object} [dbSession] - Optional Mongoose transaction session
// @returns {Promise<boolean>} false when the task was modified by someone else
const saveTaskWithVersionGuard = async (task, expectedUpdatedAt, dbSession = undefined) => {
  if (!expectedUpdatedAt) {
    await task.save({ session: dbSession })
    return true
  }

  const changes = task.$getChanges()
  const result = await Task.findOneAndUpdate(
    { _id: task._id, updatedAt: new Date(expectedUpdatedAt) },
    changes,
    { returnDocument: "after", timestamps: true, session: dbSession }
  )
  return Boolean(result)
}

// Authorization scope for task-level actions (status updates, comments) — mirrors
// getTasks' visibility filter: employees only their own tasks; managers their own
// assigned/created tasks and their direct reports' tasks; super_admin unrestricted.
// Prevents an authenticated user from acting on a task ID outside their scope.
const hasTaskAccess = async (req, task) => {
  if (req.user.role === "super_admin") return true
  if (req.user.role === "employee") {
    return task.assignedTo.toString() === req.user.id
  }
  if (req.user.role === "manager") {
    if (task.assignedBy.toString() === req.user.id || task.assignedTo.toString() === req.user.id) return true
    const assigneeIsSubordinate = await User.exists({ _id: task.assignedTo, manager: req.user.id })
    return !!assigneeIsSubordinate
  }
  return false
}

// Locked Logic §6 — "A new assignment that would push planned work past capacity must
// flag the employee as over capacity so the manager can redistribute/reschedule."
// This is advisory only: it never blocks the write, only returns a message the caller
// surfaces as a warning and the task's history records for later visibility. V1 is
// single-day capacity planning only, so there's nothing to check without a target day
// (a task with no due date, or a non-daily task's dueDate left unset).
//
// The planned-hours formula mirrors Frontend/src/lib/taskHelpers.js's
// getPlannedHoursForDay exactly — same fields, same "not Completed", same
// same-calendar-day match — so a manager never sees the UI and the API disagree.
const checkCapacityWarning = async (assigneeId, targetDate, newEstimatedHours, excludeTaskId = null) => {
  if (!assigneeId || !targetDate) return null

  const assignee = await User.findById(assigneeId).select("name dailyWorkingHours breakHours")
  if (!assignee) return null

  const [orgSettings, absences] = await Promise.all([
    getOrgSettings(),
    getAbsencesInRange(targetDate, targetDate, [assigneeId])
  ])
  const capacity = getCapacityForDay(assignee, targetDate, orgSettings, absences)

  if (capacity.hours <= 0) {
    return `${assignee.name} has no available capacity on this day (${capacity.reason || "unavailable"}) — consider a different due date.`
  }

  const otherTasks = await Task.find({
    isActive: true,
    assignedTo: assigneeId,
    status: { $ne: "Completed" },
    ...(excludeTaskId && { _id: { $ne: excludeTaskId } })
  }).select("isDaily dailyDate dueDate estimatedHours").lean()

  const existingPlannedHours = otherTasks.reduce((sum, t) => {
    const relevantDate = t.isDaily ? t.dailyDate : t.dueDate
    if (!relevantDate || !isSameCalendarDay(new Date(relevantDate), targetDate)) return sum
    return sum + (t.estimatedHours || 0)
  }, 0)

  const totalPlannedHours = existingPlannedHours + (newEstimatedHours || 0)
  if (totalPlannedHours > capacity.hours) {
    return `This puts ${assignee.name} at ${totalPlannedHours}h planned against a ${capacity.hours}h capacity that day — consider redistributing or rescheduling.`
  }
  return null
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
// Query params (all optional, all additive — omitting them preserves the original
// all-time behaviour so existing callers are unaffected):
//   scope=today|week|all   see services/taskScopeService.js
//   status=<status>        exact status match
//   assignedTo=<id>        within the caller's existing visibility scope
//   page, limit            pagination; only applied when `limit` is supplied
export const getTasks = asyncHandler(async (req, res, next) => {
  const { scope, status, assignedTo, page, limit } = req.query

  // Role visibility and scope both need $or, which can't coexist as sibling keys —
  // they're combined under $and.
  const conditions = []

  if (req.user.role === "manager") {
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    const subordinateIds = subordinates.map(s => s._id)
    conditions.push({
      $or: [
        { assignedBy: req.user.id },
        { assignedTo: req.user.id },
        { assignedTo: { $in: subordinateIds } }
      ]
    })
  } else if (req.user.role === "employee") {
    conditions.push({ assignedTo: req.user.id })
  }

  if (scope && !TASK_SCOPES.includes(scope)) {
    return next(new AppError(`scope must be one of: ${TASK_SCOPES.join(", ")}`, 400, "INVALID_SCOPE"))
  }
  const scopeFilter = buildScopeFilter(scope)
  if (scopeFilter) conditions.push(scopeFilter)

  // Reject anything that isn't a plain string matching a real status, so a non-string
  // value can never reach the Mongo query as a live operator instead of a status.
  //
  // Under this app's Express 5 the query parser defaults to `simple`, so bracket syntax
  // like `?status[$ne]=Completed` parses as the literal key "status[$ne]" and never
  // becomes an object at all (Express 4's `extended` default did build one). What DOES
  // still arrive as a non-string here is a repeated parameter — `?status=a&status=b`
  // yields an array — and that is what this guard catches today. It is kept deliberately
  // broad rather than narrowed to arrays: it must also hold if the query parser is ever
  // switched back to `extended`. Both cases are covered in
  // tests/integration/task-authorization.test.js.
  if (status) {
    if (typeof status !== "string" || !TASK_STATUSES.includes(status)) {
      return next(new AppError(`status must be one of: ${TASK_STATUSES.join(", ")}`, 400, "INVALID_STATUS"))
    }
    conditions.push({ status })
  }
  // An explicit assignee narrows within the caller's scope — it never widens it, since
  // the role condition above is ANDed alongside.
  if (assignedTo) {
    if (!mongoose.isValidObjectId(assignedTo)) {
      return next(new AppError("Invalid assignedTo", 400, "INVALID_ASSIGNEE"))
    }
    conditions.push({ assignedTo })
  }

  const filter = { isActive: true, ...(conditions.length > 0 && { $and: conditions }) }

  // Deliberately does NOT populate comments.author or history.changedBy: those two
  // populates alone issued six separate queries against `users` per request, and the
  // arrays they resolve are summarised rather than sent (see attachTrackedSecondsToTasks).
  // The detail endpoint populates them.
  let query = Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .sort({ isDaily: -1, updatedAt: -1 }) // Daily tasks appear first

  // Pagination is opt-in so callers that need the whole set (the manager dashboard's
  // capacity and forecast maths) keep working untouched.
  const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 0, 1), 200) : null
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1)
  if (parsedLimit) {
    query = query.skip((parsedPage - 1) * parsedLimit).limit(parsedLimit)
  }

  const [tasks, total] = await Promise.all([
    query,
    parsedLimit ? Task.countDocuments(filter) : Promise.resolve(null)
  ])

  const taskPlainObjects = tasks.map(t => t.toObject())
  const tasksWithTime = await attachTrackedSecondsToTasks(taskPlainObjects)

  res.json({
    tasks: tasksWithTime,
    scope: scope || "all",
    ...(total !== null && { total, page: parsedPage, limit: parsedLimit })
  })
})

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
// The full task, including the unbounded `history` and `comments` arrays that the list
// endpoint summarises away. Fetched when a detail view is opened, which is the only
// place they are rendered — so their cost is paid once, by the person who asked to see
// them, instead of on every row of every list.
export const getTaskById = asyncHandler(async (req, res, next) => {
  const { id } = req.params

  if (!mongoose.isValidObjectId(id)) {
    return next(new AppError("Task not found", 404, "TASK_NOT_FOUND"))
  }

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404, "TASK_NOT_FOUND"))
  }

  // Same scope as every other single-task action — a detail view must not become a way
  // to read a task the caller cannot otherwise touch.
  if (!(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to view this task", 403, "FORBIDDEN"))
  }

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")
    .populate("blockedBy", "name")

  res.json({ task: await getTaskWithTime(populatedTask) })
})

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
export const createTask = asyncHandler(async (req, res, next) => {
  const { title, description, category, department, assignedTo, priority, estimatedHours, dueDate } = req.body

  // An employee is always forced to self — never trust the client to assign work to
  // someone else (see CLAUDE.md Authorization rule). A manager/super_admin keeps their
  // existing ability to assign to anyone they can see, but defaults to themselves when
  // no assignee is given — this is what lets the same self-assign "Create Task" modal
  // (no assignee field) be reused for a manager/admin's own "My Work" tab.
  const targetAssignedTo = req.user.role === "employee" ? req.user.id : (assignedTo || req.user.id)

  if (!title || !targetAssignedTo) {
    return next(new AppError("Title and assignedTo fields are required", 400))
  }

  // Same bound as updateTask's estimatedHours validation — this is the other place
  // the field enters the system, and it feeds every downstream capacity/overrun
  // calculation, so an unvalidated value here would silently corrupt those numbers.
  const parsedEstimatedHours = estimatedHours === undefined || estimatedHours === null || estimatedHours === ""
    ? 0
    : Number(estimatedHours)
  if (!Number.isFinite(parsedEstimatedHours) || parsedEstimatedHours < 0 || parsedEstimatedHours > 100) {
    return next(new AppError("Estimated hours must be a number between 0 and 100", 400, "INVALID_ESTIMATE"))
  }

  if (priority !== undefined && !["low", "medium", "high"].includes(priority)) {
    return next(new AppError("Priority must be low, medium, or high", 400, "INVALID_PRIORITY"))
  }

  let parsedDueDate = null
  if (dueDate) {
    parsedDueDate = new Date(dueDate)
    if (Number.isNaN(parsedDueDate.getTime())) {
      return next(new AppError("Due date is not a valid date", 400, "INVALID_DUE_DATE"))
    }
  }

  // Locked Logic §6 — flag, never block, an assignment that pushes the assignee over
  // capacity for that day. Recorded in history (not just the response) so it stays
  // visible to anyone reviewing the task later, not only to whoever created it.
  const capacityWarning = await checkCapacityWarning(targetAssignedTo, parsedDueDate, parsedEstimatedHours)

  const task = await Task.create({
    title,
    description,
    category: category || "General",
    department: department || null,
    assignedBy: req.user.id,
    assignedTo: targetAssignedTo,
    priority: priority || "medium",
    estimatedHours: parsedEstimatedHours,
    dueDate: parsedDueDate,
    status: "Not Started",
    progressPercentage: 0,
    ...(capacityWarning && {
      history: [{ changedBy: req.user.id, comment: `Assigned over capacity: ${capacityWarning}` }]
    })
  })

  const populatedTask = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")

  res.status(201).json({
    task: { ...populatedTask.toObject(), totalTrackedSeconds: 0, ...computeOverrunFields(populatedTask.estimatedHours, 0) },
    ...(capacityWarning && { warning: capacityWarning })
  })
})

// ─── PUT /api/tasks/:id/status ────────────────────────────────────────────────
export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  const { status, comment, updatedAt } = req.body
  const { id } = req.params

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404))
  }

  if (!(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to update this task", 403))
  }

  // Optimistic concurrency (§29) — same check updateTask already applies to field
  // edits. Without it, two concurrent status changes on the same task (e.g. an
  // employee submitting for review while a manager reopens it) silently race:
  // both saves succeed, the timer start/stop side effects for both fire, and
  // whichever save lands last wins with no indication the other was ever lost.
  if (updatedAt && new Date(updatedAt).getTime() !== new Date(task.updatedAt).getTime()) {
    return next(new AppError("This task was changed by someone else. Reload to see the latest version.", 409, "TASK_MODIFIED"))
  }

  const isSelfAssigned = task.assignedBy.toString() === task.assignedTo.toString()
  const oldStatus = task.status

  // Validate transition using the centralized state machine config
  if (!isValidTransition(req.user.role, isSelfAssigned, oldStatus, status)) {
    return next(new AppError(`Forbidden status transition from '${oldStatus}' to '${status}' for role '${req.user.role}'`, 400))
  }

  const finalStatus = status

  // Update status and default progress
  task.status = finalStatus
  task.progressPercentage = getProgressForStatus(finalStatus)

  // Append transition to history audit trail
  task.history.push({
    fromStatus: oldStatus,
    toStatus: finalStatus,
    changedBy: req.user.id,
    comment: comment?.trim() || "Status changed."
  })

  // Handle active timer side-effects. Both paths delegate to services/taskService.js
  // so the elapsed-seconds calculation stays consistent with the timer endpoints —
  // the previous inline versions measured from `startedAt` unconditionally and so
  // counted paused time as worked time.
  let versionGuardOk
  if (finalStatus === "In Progress" && oldStatus !== "In Progress") {
    // Stops any currently active timer for this employee, then starts a new one for
    // this task — race-safe against concurrent start requests (see startSessionForTask).
    // NOT wrapped in the transaction below on purpose: its concurrency safety comes
    // from a stop-then-create sequence that reacts to the database's own duplicate-key
    // rejection (Locked Logic §2's partial unique index) plus a reconciliation pass
    // after — see the comment on startSessionForTask. Forcing that into transaction
    // semantics (where a duplicate-key error aborts the whole transaction rather than
    // being caught and retried in place) would change its failure behaviour, and it
    // is already pinned by Phase 3's concurrency suite. The atomicity gap this
    // transaction closes is the OTHER direction below, which had no such mechanism.
    await startSessionForTask(task._id, req.user.id)
    versionGuardOk = await saveTaskWithVersionGuard(task, updatedAt)
  } else if (oldStatus === "In Progress" && finalStatus !== "In Progress") {
    // Moving OUT of In Progress stops this task's session, retaining its time (Locked
    // §2). Session-stop and task-save now commit together — previously two independent
    // writes, so a crash between them could leave a stopped session behind a task that
    // still read "In Progress" with no timer running (Engineering Standards §10).
    //
    // A version conflict must abort the WHOLE transaction, not just skip the task
    // write — otherwise the session-stop half would commit anyway even though the
    // client is about to be told to reload and retry. Throwing (rather than returning
    // false) is what makes withTransaction roll it back.
    try {
      await runInTransaction(async (dbSession) => {
        await stopRunningSessionForTask(task._id, req.user.id, dbSession)
        if (!(await saveTaskWithVersionGuard(task, updatedAt, dbSession))) {
          throw new VersionConflict()
        }
      })
      versionGuardOk = true
    } catch (err) {
      if (!(err instanceof VersionConflict)) throw err
      versionGuardOk = false
    }
  } else {
    versionGuardOk = await saveTaskWithVersionGuard(task, updatedAt)
  }

  if (!versionGuardOk) {
    return next(new AppError("This task was changed by someone else. Reload to see the latest version.", 409, "TASK_MODIFIED"))
  }

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime })
})

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────

// Explicit allow-lists — anything not named here (status, isActive, history, …) is
// rejected rather than silently ignored, so the endpoint can't be used for mass
// assignment. Status changes go through PUT /:id/status and its workflow rules.
const EDITABLE_FIELDS = ["title", "description", "category", "priority", "estimatedHours", "dueDate", "assignedTo", "department"]
const EMPLOYEE_EDITABLE_FIELDS = ["title", "description", "priority", "estimatedHours", "dueDate"]

// Renders a value for the audit trail. History stores display strings, not ObjectIds,
// so the task timeline can render an edit without extra populates.
const formatHistoryValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "—"
  if (field === "dueDate") return new Date(value).toISOString().split("T")[0]
  return String(value)
}

export const updateTask = asyncHandler(async (req, res, next) => {
  const { id } = req.params
  // `updatedAt` (concurrency check) and `comment` (optional note for the audit entry)
  // are control fields, not editable task fields — keep them out of `fields` so they
  // don't trip the allow-list check below.
  const { updatedAt, comment, ...fields } = req.body

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404, "TASK_NOT_FOUND"))
  }

  if (!(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to edit this task", 403, "FORBIDDEN"))
  }

  // Locked Logic §4 — a completed task's record is final. Comments remain allowed
  // via POST /:id/comments.
  if (task.status === "Completed") {
    return next(new AppError("Completed tasks are locked and cannot be edited", 409, "TASK_LOCKED"))
  }

  // Optimistic concurrency (§29) — reject a write based on a stale copy rather than
  // silently overwriting another user's change.
  if (updatedAt && new Date(updatedAt).getTime() !== new Date(task.updatedAt).getTime()) {
    return next(new AppError("This task was changed by someone else. Reload to see the latest version.", 409, "TASK_MODIFIED"))
  }

  // ── Field-level authorization ───────────────────────────────────────────────
  const isEmployee = req.user.role === "employee"
  if (isEmployee && task.assignedBy.toString() !== task.assignedTo.toString()) {
    return next(new AppError("You can only edit tasks you created yourself", 403, "FORBIDDEN"))
  }
  const allowedFields = isEmployee ? EMPLOYEE_EDITABLE_FIELDS : EDITABLE_FIELDS

  const requested = Object.keys(fields).filter(k => fields[k] !== undefined)
  if (requested.length === 0) {
    return next(new AppError("No editable fields provided", 400, "NO_CHANGES"))
  }
  const forbidden = requested.filter(f => !allowedFields.includes(f))
  if (forbidden.length > 0) {
    return next(new AppError(`You are not allowed to edit: ${forbidden.join(", ")}`, 403, "FIELD_NOT_EDITABLE"))
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  let warning = null

  if (requested.includes("title")) {
    const title = String(fields.title).trim()
    if (!title) return next(new AppError("Title cannot be empty", 400, "INVALID_TITLE"))
    if (title.length > 200) return next(new AppError("Title cannot exceed 200 characters", 400, "INVALID_TITLE"))
    fields.title = title
  }

  if (requested.includes("estimatedHours")) {
    const hours = Number(fields.estimatedHours)
    if (!Number.isFinite(hours) || hours < 0 || hours > 100) {
      return next(new AppError("Estimated hours must be a number between 0 and 100", 400, "INVALID_ESTIMATE"))
    }
    fields.estimatedHours = hours
  }

  if (requested.includes("dueDate")) {
    if (fields.dueDate === null) {
      // clearing the due date is legitimate
    } else {
      const due = new Date(fields.dueDate)
      if (Number.isNaN(due.getTime())) {
        return next(new AppError("Due date is not a valid date", 400, "INVALID_DUE_DATE"))
      }
      fields.dueDate = due
      // A past due date is allowed (backfilling is legitimate) but is worth flagging.
      if (due < new Date(new Date().setHours(0, 0, 0, 0))) {
        warning = "The due date you set is in the past — this task will show as overdue."
      }
    }
  }

  if (requested.includes("priority") && !["low", "medium", "high"].includes(fields.priority)) {
    return next(new AppError("Priority must be low, medium, or high", 400, "INVALID_PRIORITY"))
  }

  if (requested.includes("description")) {
    fields.description = String(fields.description).trim()
    if (fields.description.length > 5000) {
      return next(new AppError("Description cannot exceed 5000 characters", 400, "INVALID_DESCRIPTION"))
    }
  }

  if (requested.includes("category")) {
    fields.category = String(fields.category).trim() || "General"
  }

  // ── Reassignment ────────────────────────────────────────────────────────────
  const isReassignment = requested.includes("assignedTo") &&
    String(fields.assignedTo) !== task.assignedTo.toString()

  let previousAssigneeName = null
  let newAssigneeName = null

  if (isReassignment) {
    // Daily tasks are generated per employee from a template and matched on
    // (assignedTo, templateRef, dailyDate) by the provisioning service — moving one
    // to another person would orphan it from that cycle.
    if (task.isDaily) {
      return next(new AppError("Daily tasks are generated per employee and cannot be reassigned", 400, "DAILY_TASK_NOT_REASSIGNABLE"))
    }

    if (!mongoose.isValidObjectId(fields.assignedTo)) {
      return next(new AppError("Invalid assignee", 400, "INVALID_ASSIGNEE"))
    }
    const newAssignee = await User.findById(fields.assignedTo).select("name isActive manager")
    if (!newAssignee || !newAssignee.isActive) {
      return next(new AppError("The selected assignee is not an active user", 400, "INVALID_ASSIGNEE"))
    }
    // A manager may only reassign within their own reporting line.
    if (req.user.role === "manager") {
      const inScope = newAssignee._id.toString() === req.user.id ||
        await User.exists({ _id: newAssignee._id, manager: req.user.id })
      if (!inScope) {
        return next(new AppError("You can only assign tasks to your own team members", 403, "ASSIGNEE_OUT_OF_SCOPE"))
      }
    }
    newAssigneeName = newAssignee.name
    const previousAssignee = await User.findById(task.assignedTo).select("name")
    previousAssigneeName = previousAssignee?.name || "—"
  }

  if (requested.includes("department") && fields.department) {
    if (!mongoose.isValidObjectId(fields.department)) {
      return next(new AppError("Invalid department", 400, "INVALID_DEPARTMENT"))
    }
  }

  // ── Build the audit trail, then apply ───────────────────────────────────────
  const changes = []
  for (const field of requested) {
    const oldValue = task[field]
    const newValue = fields[field]

    const oldComparable = oldValue instanceof Date ? oldValue.getTime() : String(oldValue ?? "")
    const newComparable = newValue instanceof Date ? newValue.getTime() : String(newValue ?? "")
    if (oldComparable === newComparable) continue // unchanged — don't log noise

    if (field === "assignedTo") {
      changes.push({ field, from: previousAssigneeName, to: newAssigneeName })
    } else if (field === "department") {
      const [oldDept, newDept] = await Promise.all([
        oldValue ? Department.findById(oldValue).select("name") : null,
        newValue ? Department.findById(newValue).select("name") : null
      ])
      changes.push({ field, from: oldDept?.name || "—", to: newDept?.name || "—" })
    } else {
      changes.push({ field, from: formatHistoryValue(field, oldValue), to: formatHistoryValue(field, newValue) })
    }

    task[field] = newValue
  }

  if (changes.length === 0) {
    return next(new AppError("No changes were made", 400, "NO_CHANGES"))
  }

  // Reassigning away from someone actively tracking time closes out their session —
  // the time itself is always retained on the task (Locked Logic §2).
  if (isReassignment) {
    const stopped = await stopRunningSessionForTask(task._id)
    if (stopped && task.status === "In Progress") {
      task.status = "Pending"
      task.history.push({
        fromStatus: "In Progress",
        toStatus: "Pending",
        changedBy: req.user.id,
        comment: "Timer stopped — task reassigned"
      })
    }
  }

  // Locked Logic §6 — re-check capacity whenever a field that affects it actually
  // changed (estimate, due date, or reassignment). `task.*` already holds the new
  // values from the loop above, so this reflects exactly what's about to be saved.
  // Flag-only, same as createTask — never blocks the write.
  const capacityRelevantChange = changes.some(c => ["estimatedHours", "dueDate", "assignedTo"].includes(c.field))
  if (capacityRelevantChange) {
    const targetDate = task.isDaily ? task.dailyDate : task.dueDate
    const capacityWarning = await checkCapacityWarning(task.assignedTo, targetDate, task.estimatedHours, task._id)
    if (capacityWarning) {
      warning = warning ? `${warning} ${capacityWarning}` : capacityWarning
      task.history.push({ changedBy: req.user.id, comment: `Now over capacity: ${capacityWarning}` })
    }
  }

  task.history.push({
    changes,
    changedBy: req.user.id,
    comment: comment?.trim() || ""
  })

  if (!(await saveTaskWithVersionGuard(task, updatedAt))) {
    return next(new AppError("This task was changed by someone else. Reload to see the latest version.", 409, "TASK_MODIFIED"))
  }

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime, ...(warning && { warning }) })
})

// ─── PATCH /api/tasks/:id/blocked ─────────────────────────────────────────────
// Separate from the general PATCH because the authorization differs: the ASSIGNEE can
// declare their own task blocked even though they can't edit its other fields. Being
// stuck is the one thing the person doing the work always knows first.
export const setTaskBlocked = asyncHandler(async (req, res, next) => {
  const { id } = req.params
  const { isBlocked, reason } = req.body

  if (typeof isBlocked !== "boolean") {
    return next(new AppError("isBlocked must be true or false", 400, "INVALID_INPUT"))
  }

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404, "TASK_NOT_FOUND"))
  }

  // Assignee, or anyone with management access to the task.
  const isAssignee = task.assignedTo.toString() === req.user.id
  if (!isAssignee && !(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to change this task", 403, "FORBIDDEN"))
  }

  if (task.status === "Completed") {
    return next(new AppError("Completed tasks cannot be marked blocked", 409, "TASK_LOCKED"))
  }

  if (isBlocked) {
    if (!reason || !reason.trim()) {
      return next(new AppError("Say what the task is blocked on", 400, "REASON_REQUIRED"))
    }
    if (reason.trim().length > 300) {
      return next(new AppError("Reason cannot exceed 300 characters", 400, "REASON_TOO_LONG"))
    }
    if (task.isBlocked) {
      return next(new AppError("This task is already marked blocked", 409, "ALREADY_BLOCKED"))
    }

    task.isBlocked = true
    task.blockedReason = reason.trim()
    task.blockedAt = new Date()
    task.blockedBy = req.user.id
    task.history.push({
      changes: [{ field: "isBlocked", from: "no", to: "yes" }],
      changedBy: req.user.id,
      comment: reason.trim()
    })
  } else {
    if (!task.isBlocked) {
      return next(new AppError("This task is not blocked", 409, "NOT_BLOCKED"))
    }
    task.isBlocked = false
    task.blockedReason = ""
    task.blockedAt = null
    task.blockedBy = null
    task.history.push({
      changes: [{ field: "isBlocked", from: "yes", to: "no" }],
      changedBy: req.user.id,
      comment: reason?.trim() || "Unblocked"
    })
  }

  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")
    .populate("blockedBy", "name")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime })
})

// ─── DELETE /api/tasks/:id — soft-delete (cancel) ────────────────────────────
// Core Rule 2: never hard-delete. The task drops out of every list and metric via
// the `isActive: true` filter every query already applies, while its work sessions
// and audit trail remain intact.
export const cancelTask = asyncHandler(async (req, res, next) => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason || !reason.trim()) {
    return next(new AppError("A reason is required to cancel a task", 400, "REASON_REQUIRED"))
  }
  if (reason.trim().length > 300) {
    return next(new AppError("Reason cannot exceed 300 characters", 400, "REASON_TOO_LONG"))
  }

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404, "TASK_NOT_FOUND"))
  }

  if (!(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to cancel this task", 403, "FORBIDDEN"))
  }

  // Completed work is part of the historical record and must stay in the metrics.
  if (task.status === "Completed") {
    return next(new AppError("Completed tasks cannot be cancelled", 409, "TASK_LOCKED"))
  }

  // An employee may only cancel their own self-created task, and only before work
  // has started — once it's in flight, cancelling is a manager decision.
  if (req.user.role === "employee") {
    const isSelfCreated = task.assignedBy.toString() === task.assignedTo.toString()
    if (!isSelfCreated) {
      return next(new AppError("You can only cancel tasks you created yourself", 403, "FORBIDDEN"))
    }
    if (task.status !== "Not Started") {
      return next(new AppError("You can only cancel a task that hasn't been started", 403, "TASK_IN_PROGRESS"))
    }
  }

  // Close out any running timer so it doesn't dangle against a cancelled task.
  // The session itself is retained (Locked Logic §2).
  await stopRunningSessionForTask(task._id)

  task.isActive = false
  task.history.push({
    changes: [{ field: "isActive", from: "active", to: "cancelled" }],
    changedBy: req.user.id,
    comment: reason.trim()
  })
  await task.save()

  res.json({ success: true, message: "Task cancelled", taskId: task._id })
})

// ─── POST /api/tasks/:id/comments ────────────────────────────────────────────
export const addComment = asyncHandler(async (req, res, next) => {
  const { text } = req.body
  const { id } = req.params

  if (!text || !text.trim()) {
    return next(new AppError("Comment text is required", 400))
  }

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404))
  }

  if (!(await hasTaskAccess(req, task))) {
    return next(new AppError("You do not have permission to comment on this task", 403))
  }

  task.comments.push({ text: text.trim(), author: req.user.id })
  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime })
})

// ─── GET /api/tasks/daily — Ensure today's daily tasks exist for employee ────
export const ensureDailyTasks = asyncHandler(async (req, res) => {
  // The midnight cron (see services/dailyTaskService.js) already provisions daily tasks
  // for everyone; this route just self-heals immediately on login in case the cron
  // hasn't run yet (e.g. server was down) or an employee was activated mid-day.
  await provisionDailyTasksForEmployee(req.user.id)
  res.json({ success: true, message: "Daily tasks provisioned" })
})

// Below this, tracked time on an estimated task counts as "not meaningfully measured"
// for Estimation Accuracy — the same treatment as zero, not a tiny denominator that
// blows the ratio up (see the comment beside estimationAccuracy below).
const MIN_MEASURABLE_TRACKED_HOURS = 1 / 60 // 1 minute

// ─── GET /api/tasks/report — Admin progress report ───────────────────────────
export const getProgressReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query

  // ── 1. Fetch active reportable users — a manager sees their direct reports
  //      PLUS their own row (a manager is also a worker); an employee sees only
  //      themselves; super_admin sees the whole org, including managers and
  //      themselves (Locked Logic §12, extended: role is a responsibility layered
  //      on top of "has work," not the sole definition of who can be reported on).
  //      Computed first so every task/overdue query below can be scoped to the
  //      same employee set — every report section must agree on "whose org this
  //      is," not just employeeReport.
  const userFilter = { isActive: true }
  if (req.user.role === "manager") {
    userFilter.$or = [{ role: "employee", manager: req.user.id }, { _id: req.user.id }]
  } else if (req.user.role === "employee") {
    userFilter._id = req.user.id
  } else {
    // super_admin: every active employee and manager, plus the admin's own row
    userFilter.role = { $in: ["employee", "manager", "super_admin"] }
  }
  const users = await User.find(userFilter)
    .populate("department", "name")
    .populate("team", "name")
    .lean()
  const visibleUserIds = users.map(u => u._id)

  // ── 2. Build Task Query with Date Filters ──────────────────────────────────
  const query = { isActive: true }
  if (req.user.role !== "super_admin") {
    query.assignedTo = { $in: visibleUserIds }
  }
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    // If only YYYY-MM-DD is passed, make sure end covers the entire day.
    // Use setUTCHours, not setHours — the date strings here are UTC-parsed
    // (new Date("YYYY-MM-DD") is UTC midnight), so a local-time setHours on a
    // server running in a timezone ahead of UTC (e.g. IST) would push the
    // boundary hours earlier than intended, silently dropping same-day tasks.
    if (endDate.length <= 10) {
      end.setUTCHours(23, 59, 59, 999)
    }
    query.$or = [
      { createdAt: { $gte: start, $lte: end } },
      { dailyDate: { $gte: start, $lte: end } }
    ]
  }

  const tasks = await Task.find(query)
    .populate("assignedTo", "name email department team")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .lean()

  const taskIds = tasks.map(t => t._id)

  // ── 3. Batch-aggregate tracked seconds for all tasks ──────────────────────
  const matchSession = { task: { $in: taskIds }, stoppedAt: { $ne: null } }
  const activeSessionFilter = { task: { $in: taskIds }, stoppedAt: null }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (endDate.length <= 10) {
      end.setUTCHours(23, 59, 59, 999)
    }
    // Filtered on `startedAt`, matching the day-attribution rule documented in
    // workSessionController.getTodayTrackedHours: a session belongs wholly to the day it
    // started. A session that began before this range therefore belongs to an earlier
    // period and is correctly excluded, even though part of its clock ran inside the
    // range — the alternative would report the same hours in two different periods.
    matchSession.startedAt = { $gte: start, $lte: end }
    activeSessionFilter.startedAt = { $gte: start, $lte: end }
  }

  const sessionAgg = await WorkSession.aggregate([
    { $match: matchSession },
    { $group: { _id: "$task", totalStopped: { $sum: "$totalSeconds" } } }
  ])
  const activeSessions = await WorkSession.find(activeSessionFilter)

  const stoppedMap = {}
  sessionAgg.forEach(s => { stoppedMap[s._id.toString()] = s.totalStopped })
  const activeMap = {}
  activeSessions.forEach(s => { activeMap[s.task.toString()] = calculateSessionElapsedSeconds(s) })

  const trackedMap = {}
  taskIds.forEach(id => {
    const sid = id.toString()
    trackedMap[sid] = (stoppedMap[sid] || 0) + (activeMap[sid] || 0)
  })

  // ── 3b. Overdue is an absolute, always-current signal — computed from the full
  //      active task set regardless of the report's date filter, so switching the
  //      timeframe dropdown never changes what counts as overdue. Still scoped to
  //      the same visible-employee set as everything else in this report.
  const overdueQuery = {
    isActive: true,
    dueDate: { $lt: new Date() },
    status: { $ne: "Completed" }
  }
  if (req.user.role !== "super_admin") {
    overdueQuery.assignedTo = { $in: visibleUserIds }
  }
  const overdueTasks = await Task.find(overdueQuery)
    .select("assignedTo department priority")
    .populate({ path: "assignedTo", select: "team department" })
    .lean()

  const overdueByEmployee = {}
  const overdueByDept = {}
  const overdueByTeam = {}
  const overdueByPriority = {}
  overdueTasks.forEach(t => {
    const empId = t.assignedTo?._id?.toString()
    if (empId) overdueByEmployee[empId] = (overdueByEmployee[empId] || 0) + 1

    // Same department-of-record rule as departmentReport below.
    const deptId = (t.department ?? t.assignedTo?.department)?.toString() || "unassigned"
    overdueByDept[deptId] = (overdueByDept[deptId] || 0) + 1

    const teamId = t.assignedTo?.team?.toString() || "unassigned"
    overdueByTeam[teamId] = (overdueByTeam[teamId] || 0) + 1

    if (t.priority) overdueByPriority[t.priority] = (overdueByPriority[t.priority] || 0) + 1
  })

  // Calendar context, fetched once for the whole report rather than per employee.
  const orgSettings = await getOrgSettings()
  const absencesToday = await getAbsencesInRange(new Date(), new Date(), users.map(u => u._id))

  // ── 4. Employee-wise report ───────────────────────────────────────────────
  const employeeReport = users.map(u => {
    const uTasks = tasks.filter(t => t.assignedTo && t.assignedTo._id.toString() === u._id.toString())
    const total = uTasks.length
    const completed = uTasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = uTasks.filter(t => t.status === "In Progress").length
    const pending = uTasks.filter(t => t.status === "Pending").length
    const overdue = overdueByEmployee[u._id.toString()] || 0
    const totalTrackedSeconds = uTasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const avgProgress = total > 0 ? Math.round(uTasks.reduce((acc, t) => acc + t.progressPercentage, 0) / total) : 0
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Detailed employee tasks list for drilldown
    const employeeTasks = uTasks.map(t => ({
      _id: t._id,
      title: t.title,
      description: t.description || "",
      category: t.category || "General",
      priority: t.priority,
      status: t.status,
      progressPercentage: t.progressPercentage,
      estimatedHours: t.estimatedHours || 0,
      totalTrackedSeconds: trackedMap[t._id.toString()] || 0,
      dueDate: t.dueDate,
      createdAt: t.createdAt
    }))

    // Calculate Avg. Resolution Velocity in Days
    const completedTasks = uTasks.filter(t => ["Completed"].includes(t.status))
    let totalResolutionTimeMs = 0
    completedTasks.forEach(t => {
      const completionHistory = t.history?.find(h => ["Completed"].includes(h.toStatus))
      const completionTime = completionHistory ? new Date(completionHistory.timestamp) : new Date(t.updatedAt)
      const duration = completionTime.getTime() - new Date(t.createdAt).getTime()
      totalResolutionTimeMs += Math.max(0, duration)
    })
    const avgResolutionDays = completedTasks.length > 0
      ? parseFloat(((totalResolutionTimeMs / (1000 * 60 * 60 * 24)) / completedTasks.length).toFixed(1))
      : 0

    // Calculate Estimation Accuracy (Tracked vs Estimated)
    const completedWithEstimation = completedTasks.filter(t => t.estimatedHours > 0)
    let totalEstimatedHours = 0
    let totalTrackedHoursForEst = 0
    completedWithEstimation.forEach(t => {
      totalEstimatedHours += t.estimatedHours
      totalTrackedHoursForEst += (trackedMap[t._id.toString()] || 0) / 3600
    })
    // The 0.1-hour floor this used to divide by turned "estimated but never tracked"
    // (a real, reachable state — a task can be marked Completed with no time logged
    // against it) into a nonsensical >4000% figure instead of "not measurable." null
    // matches the convention used elsewhere in this report (e.g. utilization below)
    // for "there's nothing meaningful to show here."
    //
    // That earlier fix only caught EXACTLY zero tracked time. A task completed with a
    // few seconds of tracked time against an hours-long estimate hits the same
    // nonsensical-percentage problem from the other side (estimated/tracked with a
    // near-zero denominator) — seen live as "122727%". MIN_MEASURABLE_TRACKED_HOURS
    // treats anything under a minute as not meaningfully measured, same as zero,
    // rather than letting a tiny denominator blow the ratio up.
    const estimationAccuracy = totalEstimatedHours > 0
      ? (totalTrackedHoursForEst > MIN_MEASURABLE_TRACKED_HOURS ? Math.round((totalEstimatedHours / totalTrackedHoursForEst) * 100) : null)
      : 100 // default to 100 if no estimates configured

    // Daily vs Assigned completion, tracked separately (Locked Logic §7) — Overall
    // completionRate above is the derived summary, not the primary metric.
    const dailyTasks = uTasks.filter(t => t.isDaily)
    const dailyNewCount = dailyTasks.filter(t => !t.isCarryForward).length
    const dailyCarriedForwardCount = dailyTasks.filter(t => t.isCarryForward).length
    const dailyCompletedCount = dailyTasks.filter(t => t.status === "Completed").length
    const dailyCompletionRate = dailyTasks.length > 0 ? Math.round((dailyCompletedCount / dailyTasks.length) * 100) : 0

    const assignedTasks = uTasks.filter(t => !t.isDaily)
    const assignedCompletedCount = assignedTasks.filter(t => t.status === "Completed").length
    const assignedCompletionRate = assignedTasks.length > 0 ? Math.round((assignedCompletedCount / assignedTasks.length) * 100) : 0

    // Planned vs Actual Capacity Utilization + a distinct Capacity Overrun signal —
    // today only, matching V1 single-day capacity planning (Locked Logic §6/§7).
    //
    // Capacity comes from calendarService, the single source of truth shared with
    // provisioning and (via /api/calendar/context) the frontend — this used to
    // reimplement the formula inline and could drift from taskHelpers.js.
    const today = new Date()
    const todaysTasks = uTasks.filter(t => {
      const relevantDate = t.isDaily ? t.dailyDate : t.dueDate
      return relevantDate && isSameCalendarDay(new Date(relevantDate), today)
    })
    const capacityToday = getCapacityForDay(u, today, orgSettings, absencesToday)
    const capacityHours = capacityToday.hours
    const plannedHoursToday = todaysTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    const actualHoursToday = todaysTasks.reduce((sum, t) => sum + (trackedMap[t._id.toString()] || 0), 0) / 3600

    // When there's no capacity today (weekend, holiday, leave) utilisation is not a
    // meaningful number — nobody is "0% utilised" on a Sunday, the question doesn't
    // apply. Return null so the UI renders "—" instead of an alarming 0% (§41).
    const plannedUtilizationPct = capacityHours > 0 ? Math.round((plannedHoursToday / capacityHours) * 100) : null
    const actualUtilizationPct = capacityHours > 0 ? Math.round((actualHoursToday / capacityHours) * 100) : null
    // Likewise, doing twenty minutes on a day off is not a capacity overrun.
    const isCapacityOverrunToday = capacityHours > 0 && actualHoursToday > capacityHours

    // Estimation pattern (Locked Logic §10) — always retains the underlying task-level
    // data (recentEstimatedTasks) so a manager can drill into exactly which tasks caused it.
    const recentEstimatedTasks = [...completedWithEstimation]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, PATTERN_LOOKBACK)
      .map(t => {
        const trackedSeconds = trackedMap[t._id.toString()] || 0
        const estimatedSeconds = t.estimatedHours * 3600
        return {
          _id: t._id,
          title: t.title,
          estimatedHours: t.estimatedHours,
          trackedHours: parseFloat((trackedSeconds / 3600).toFixed(1)),
          overrunPercentage: estimatedSeconds > 0 ? Math.round(((trackedSeconds - estimatedSeconds) / estimatedSeconds) * 100) : 0,
          isOverrun: trackedSeconds > estimatedSeconds
        }
      })
    const recentOverrunCount = recentEstimatedTasks.filter(t => t.isOverrun).length
    const recentOverrunProportion = recentEstimatedTasks.length > 0
      ? parseFloat((recentOverrunCount / recentEstimatedTasks.length).toFixed(2))
      : 0
    const hasOverrunPattern = recentEstimatedTasks.length >= PATTERN_MIN_SAMPLE && recentOverrunProportion > PATTERN_THRESHOLD

    // Quality / rework (Locked Logic §9 — "distinguish approved work from returned work";
    // §11 — keep it a separate signal, never folded into a score).
    //
    // Denominator is COMPLETED tasks that actually went through review. An employee on
    // mostly daily work has none, and must read as "not applicable" rather than 0% or
    // 100% (§41).
    const reviewedCompletedTasks = completedTasks.filter(wasEverReviewed)
    const reviewedTaskCount = reviewedCompletedTasks.length
    const firstPassTasks = reviewedCompletedTasks.filter(t => getReworkCount(t) === 0)
    const firstPassApprovalRate = reviewedTaskCount > 0
      ? Math.round((firstPassTasks.length / reviewedTaskCount) * 100)
      : null
    const reworkRate = reviewedTaskCount > 0
      ? Math.round(((reviewedTaskCount - firstPassTasks.length) / reviewedTaskCount) * 100)
      : null
    // Small samples are deliberately not flagged, mirroring the estimation-pattern rule.
    const hasQualitySignal = reviewedTaskCount >= QUALITY_MIN_SAMPLE &&
      (reworkRate / 100) > QUALITY_THRESHOLD

    // Every flag stays traceable to the specific tasks and the feedback given (§10/§12).
    const reworkedTasks = uTasks
      .filter(t => getReworkCount(t) > 0)
      .map(t => ({
        _id: t._id,
        title: t.title,
        status: t.status,
        reworkCount: getReworkCount(t),
        lastFeedback: getLastReworkFeedback(t)
      }))
      .sort((a, b) => b.reworkCount - a.reworkCount)

    // Backlog signals (Locked Logic §8), split into the two things "Pending" used to
    // conflate:
    //   paused  — the timer isn't running. A count only; its "age" is meaningless
    //             because it mostly measures overnight and weekends.
    //   blocked — explicitly declared stuck, with a reason. THIS is the backlog signal
    //             worth ageing, and it's aged in working days.
    const pausedCount = uTasks.filter(t => t.status === "Pending" && !t.isBlocked).length

    const blockedTasksList = uTasks.filter(t => t.isBlocked)
    const blockedAges = blockedTasksList.map(t => getBlockedAgeDays(t, orgSettings)).filter(a => a !== null)
    const blockedBacklogAvgAgeDays = blockedAges.length > 0
      ? parseFloat((blockedAges.reduce((a, b) => a + b, 0) / blockedAges.length).toFixed(1))
      : 0
    const blockedBacklogOldestAgeDays = blockedAges.length > 0
      ? parseFloat(Math.max(...blockedAges).toFixed(1))
      : 0
    // Task-level detail so a blocked flag is always traceable to specific work and its
    // reason (Locked Logic §12) — a manager can usually unblock it on the spot.
    const blockedTasks = blockedTasksList.map(t => ({
      _id: t._id,
      title: t.title,
      reason: t.blockedReason || "",
      status: t.status,
      ageDays: getBlockedAgeDays(t, orgSettings) ?? 0
    }))

    // Retained so nothing reading the old key breaks; now carries the blocked-based
    // figure, which is what the label always meant. Prefer blockedBacklog* in new code.
    const pendingBacklogAvgAgeDays = blockedBacklogAvgAgeDays
    const pendingBacklogOldestAgeDays = blockedBacklogOldestAgeDays

    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      // Present so consumers can distinguish "employee" rows from a manager/admin's
      // own row now that this report is no longer employee-only (§7 of the hierarchy
      // requirements) — the subject isn't always someone's direct report.
      role: u.role,
      department: u.department?.name || "—",
      team: u.team?.name || "—",
      total,
      completed,
      inProgress,
      pending,
      overdue,
      totalTrackedSeconds,
      avgProgress,
      completionRate,
      tasks: employeeTasks,
      avgResolutionDays,
      estimationAccuracy,
      // Productivity signals (Locked Logic §7/§8/§11) — kept separate, never combined
      // into a single score.
      dailyCompletionRate,
      dailyNewCount,
      dailyCarriedForwardCount,
      assignedCompletionRate,
      assignedTotal: assignedTasks.length,
      overallCompletionRate: completionRate,
      capacityHoursToday: capacityHours,
      // Why capacity is what it is today: null | "weekend" | "holiday" | "leave" |
      // "half_day" | "no_hours_configured". Lets the UI say "on leave" instead of "0%".
      capacityReasonToday: capacityToday.reason,
      isWorkingDayToday: capacityToday.isWorkingDay,
      plannedUtilizationPct,
      actualUtilizationPct,
      isCapacityOverrunToday,
      reviewedTaskCount,
      firstPassApprovalRate,
      reworkRate,
      hasQualitySignal,
      reworkedTasks,
      pausedCount,
      blockedCount: blockedTasksList.length,
      blockedBacklogAvgAgeDays,
      blockedBacklogOldestAgeDays,
      blockedTasks,
      // Deprecated aliases — see above.
      pendingBacklogAvgAgeDays,
      pendingBacklogOldestAgeDays,
      hasOverrunPattern,
      recentOverrunProportion,
      recentEstimatedTasks
    }
  })

  // ── 5. Department-wise report ─────────────────────────────────────────────
  // DEPARTMENT OF RECORD: the task's own department when one is set, otherwise the
  // assignee's.
  //
  // This report used to group purely on `task.department`, which createTask leaves null
  // unless a manager fills that field — so nearly everything landed in "Unassigned" and
  // real departments read as zero, while the Teams report sitting beside it (grouped by
  // the PERSON's team) showed the same work under a real team. Two tables, the same
  // people, no way to tell why they disagreed (§14).
  //
  // Falling back rather than ignoring `task.department` keeps the case the field exists
  // for: an engineer doing a piece of Finance work stays attributed to Finance. Only the
  // reporting changes — no stored task is touched.
  //
  // The assignee's department is read from `users`, which is already loaded and
  // populated, so this costs no extra query. A task whose assignee is outside that set
  // (e.g. deactivated) still falls through to "Unassigned".
  const departmentByUserId = new Map(
    users.map(u => [u._id.toString(), u.department])
  )

  const deptMap = {}
  tasks.forEach(t => {
    const department = t.department ?? departmentByUserId.get(t.assignedTo?._id?.toString())
    const deptId = department?._id?.toString() || "unassigned"
    const deptName = department?.name || "Unassigned"
    if (!deptMap[deptId]) deptMap[deptId] = { deptId, deptName, tasks: [] }
    deptMap[deptId].tasks.push(t)
  })

  const departmentReport = Object.values(deptMap).map(d => {
    const total = d.tasks.length
    const completed = d.tasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = d.tasks.filter(t => t.status === "In Progress").length
    const overdue = overdueByDept[d.deptId] || 0
    const totalTrackedSeconds = d.tasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const memberSet = new Set(d.tasks.map(t => t.assignedTo?._id?.toString()).filter(Boolean))
    return { deptId: d.deptId, name: d.deptName, total, completed, inProgress, overdue, totalTrackedSeconds, completionRate, memberCount: memberSet.size }
  })

  // ── 6. Team-wise report ───────────────────────────────────────────────────
  const teamUserMap = {}
  users.forEach(u => {
    const teamId = u.team?._id?.toString() || "unassigned"
    const teamName = u.team?.name || "No Team"
    if (!teamUserMap[teamId]) teamUserMap[teamId] = { teamId, teamName, memberIds: [] }
    teamUserMap[teamId].memberIds.push(u._id.toString())
  })

  const teamReport = Object.values(teamUserMap).map(team => {
    const tTasks = tasks.filter(t => t.assignedTo && team.memberIds.includes(t.assignedTo._id.toString()))
    const total = tTasks.length
    const completed = tTasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = tTasks.filter(t => t.status === "In Progress").length
    const overdue = overdueByTeam[team.teamId] || 0
    const totalTrackedSeconds = tTasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { teamId: team.teamId, name: team.teamName, total, completed, inProgress, overdue, totalTrackedSeconds, completionRate, memberCount: team.memberIds.length }
  })

  // ── 7. Task health report ─────────────────────────────────────────────────
  const allTasks = tasks
  const healthReport = {
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter(t => ["Completed"].includes(t.status)).length,
    inProgressTasks: allTasks.filter(t => t.status === "In Progress").length,
    notStartedTasks: allTasks.filter(t => t.status === "Not Started").length,
    overdueTasks: overdueTasks.length,
    pendingTasks: allTasks.filter(t => t.status === "Pending").length,
    inReviewTasks: allTasks.filter(t => t.status === "In Review").length,
    blockedTasks: allTasks.filter(t => t.isBlocked).length,
    reworkedTasks: allTasks.filter(t => getReworkCount(t) > 0).length,
    totalTrackedSeconds: Object.values(trackedMap).reduce((a, b) => a + b, 0),
    avgCompletionRate: allTasks.length > 0
      ? Math.round(allTasks.filter(t => ["Completed"].includes(t.status)).length / allTasks.length * 100)
      : 0
  }

  // ── 8. Priority breakdown ─────────────────────────────────────────────────
  const priorityReport = ["high", "medium", "low"].map(p => {
    const pTasks = allTasks.filter(t => t.priority === p)
    return {
      priority: p,
      total: pTasks.length,
      completed: pTasks.filter(t => ["Completed"].includes(t.status)).length,
      overdue: overdueByPriority[p] || 0
    }
  })

  // An employee caller only ever sees their own row — department/team/org-wide
  // breakdowns stay manager/super_admin only, per "avoid showing employees
  // unnecessary organizational-level analytics."
  if (req.user.role === "employee") {
    return res.json({ employeeReport })
  }

  res.json({
    employeeReport,
    departmentReport,
    teamReport,
    healthReport,
    priorityReport
  })
})
