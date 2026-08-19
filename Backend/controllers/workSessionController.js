import WorkSession from "../models/WorkSession.js"
import Task from "../models/Task.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { runInTransaction } from "../utils/transaction.js"
import { startSessionForTask, calculateSessionElapsedSeconds } from "../services/taskService.js"
import { isValidTransition } from "../config/workflow.js"

// Elapsed seconds plus whether the clock is currently running.
//
// The arithmetic itself lives in services/taskService.js and is used by the task-side
// paths (list rollups, status transitions, the progress report, the work-log prefill).
// This wrapper adds only the `isRunning` flag the timer endpoints need.
//
// It used to be a second, independent copy of the same calculation. A contract test
// pinned the two together and caught one genuine divergence before it could bite: this
// copy read `session.events` directly and threw on a document without one, where the
// service guards with `events || []`. Collapsing them keeps the safe behaviour — which
// matters because a `.lean()` or projected read in a timer endpoint would produce
// exactly that document.
export const calculateSessionTime = (session) => {
  if (!session) return { elapsedSeconds: 0, isRunning: false }

  const events = session.events || []
  const lastEvent = events[events.length - 1]

  return {
    elapsedSeconds: calculateSessionElapsedSeconds(session),
    // Running unless the most recent event was a pause. No events at all means the
    // session has been running continuously since it started.
    isRunning: !lastEvent || lastEvent.type !== "pause"
  }
}

// Helper to stop an active session
const performStopSession = async (session, dbSession = undefined) => {
  const { elapsedSeconds } = calculateSessionTime(session)
  session.totalSeconds = elapsedSeconds
  session.stoppedAt = new Date()
  await session.save({ session: dbSession })
}

// A task only reflects "In Progress" while its timer is actively running. Any time the timer
// leaves the running state (pause, switch, stop) the task falls back to "Pending" so the
// Pending-backlog signal stays accurate. Server-side only — matches the locked timer rules.
// Starting or resuming a timer means work is demonstrably proceeding, so the task can't
// still be blocked. Clearing it automatically avoids a stale "Blocked" badge sitting on
// a task somebody is actively working on. Mutates in place — the caller saves.
//
// Used by BOTH timer entry points: startSession updates the task document directly,
// while pause/resume/stop go through setTaskStatus. Putting this in only one of them
// left the start path silently not unblocking.
const clearBlockedIfSet = (task, changedBy) => {
  if (!task.isBlocked) return false
  task.history.push({
    changes: [{ field: "isBlocked", from: "yes", to: "no" }],
    changedBy,
    comment: "Unblocked automatically — work resumed"
  })
  task.isBlocked = false
  task.blockedReason = ""
  task.blockedAt = null
  task.blockedBy = null
  return true
}

// Routes every timer-driven status change through the same state machine
// (config/workflow.js) that PUT /:id/status uses, rather than a second,
// independently-maintained set of rules — this is the sole reason a role is
// now threaded through every call site below.
const setTaskStatus = async (taskId, toStatus, changedBy, comment, role, dbSession = undefined) => {
  const task = await Task.findById(taskId).session(dbSession)
  if (!task) return

  const unblocked = toStatus === "In Progress" && clearBlockedIfSet(task, changedBy)

  if (task.status === toStatus) {
    if (unblocked) await task.save({ session: dbSession })
    return
  }
  const fromStatus = task.status
  const isSelfAssigned = task.assignedBy.toString() === task.assignedTo.toString()
  if (!isValidTransition(role, isSelfAssigned, fromStatus, toStatus)) {
    if (unblocked) await task.save({ session: dbSession })
    return
  }
  task.status = toStatus
  task.progressPercentage = toStatus === "In Progress" ? 50 : task.progressPercentage
  task.history.push({ fromStatus, toStatus, changedBy, comment })
  await task.save({ session: dbSession })
}

export const getActiveSession = asyncHandler(async (req, res) => {
  const session = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  }).populate("task", "title category status")

  if (!session) {
    return res.json({ session: null, elapsedSeconds: 0, isRunning: false })
  }

  const { elapsedSeconds, isRunning } = calculateSessionTime(session)
  res.json({
    session,
    elapsedSeconds,
    isRunning
  })
})

export const startSession = asyncHandler(async (req, res, next) => {
  const { taskId } = req.body

  if (!taskId) {
    return next(new AppError("taskId is required", 400))
  }

  // Ownership check: an employee may only start a timer against their own task
  // (never rely on the frontend to enforce this — see CLAUDE.md Authorization rule).
  const targetTask = await Task.findById(taskId)
  if (!targetTask || !targetTask.isActive) {
    return next(new AppError("Task not found", 404))
  }
  if (targetTask.assignedTo.toString() !== req.user.id) {
    return next(new AppError("You do not have permission to track time on this task", 403))
  }

  // Refuse to start a timer on work that cannot legitimately be in progress.
  //
  // Previously the session was created BEFORE the workflow rules were consulted, so a
  // timer could run against a Completed task: the status transition was correctly
  // refused, the task stayed Completed, but time kept accruing against a record Locked
  // Logic §4 calls final — quietly moving its estimated-vs-actual variance and overrun
  // badge. The same held for work sitting In Review, which is out of the employee's
  // hands. Checking first makes the refusal explicit instead of silently partial.
  const isSelfAssigned = targetTask.assignedBy.toString() === targetTask.assignedTo.toString()
  const alreadyRunning = targetTask.status === "In Progress"
  if (!alreadyRunning && !isValidTransition(req.user.role, isSelfAssigned, targetTask.status, "In Progress")) {
    return next(new AppError(
      `A "${targetTask.status}" task cannot be timed. Reopen it first.`,
      409,
      "TASK_NOT_STARTABLE"
    ))
  }

  // Stop whatever this employee had running and start the new session. The sessions
  // that were actually stopped come back with it — reading the active session BEFORE
  // this call was the original bug: under two simultaneous starts the second request
  // could see "nothing active" because the first had not committed yet.
  const { session, stopped } = await startSessionForTask(taskId, req.user.id)

  // Reflect the timer on this task, if we still hold the employee's single active slot.
  const holdsTimer = () => WorkSession.exists({ _id: session._id, stoppedAt: null })

  const wasUnblocked = clearBlockedIfSet(targetTask, req.user.id)
  if (await holdsTimer() && !alreadyRunning) {
    targetTask.history.push({ fromStatus: targetTask.status, toStatus: "In Progress", changedBy: req.user.id, comment: "Timer started" })
    targetTask.status = "In Progress"
    targetTask.progressPercentage = 50
    await targetTask.save()
  } else if (wasUnblocked) {
    await targetTask.save()
  }

  // ── Reconcile, deliberately AFTER our own write has landed ────────────────────
  //
  // Ordering matters here and was the second half of the bug. Pausing the previous task
  // BEFORE its own request had committed found it still "Not Started", where
  // Not Started → Pending is not a legal transition, so the pause silently did nothing —
  // and that request then wrote "In Progress" over the top, stranding it with no timer.
  //
  // Both steps below are idempotent, so whichever request finishes last converges the
  // state rather than depending on a particular interleaving.
  for (const previous of stopped) {
    if (previous.task.toString() !== taskId) {
      await setTaskStatus(previous.task, "Pending", req.user.id, "Switched to another task", req.user.role)
    }
  }

  // And if a competing start took the slot from under us after we wrote, put our own
  // task back — otherwise WE become the stranded one.
  if (!(await holdsTimer())) {
    await setTaskStatus(taskId, "Pending", req.user.id, "Timer superseded by another task", req.user.role)
  }

  const populatedSession = await WorkSession.findById(session._id)
    .populate("task", "title category status")

  const { elapsedSeconds, isRunning } = calculateSessionTime(populatedSession)

  res.status(201).json({
    session: populatedSession,
    elapsedSeconds,
    isRunning
  })
})

export const pauseSession = asyncHandler(async (req, res, next) => {
  const session = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  }).populate("task", "title category status")

  if (!session) {
    return next(new AppError("No active work session running", 404))
  }

  const { elapsedSeconds, isRunning } = calculateSessionTime(session)
  if (!isRunning) {
    return res.json({ session, elapsedSeconds, isRunning }) // Already paused
  }

  session.totalSeconds = elapsedSeconds
  session.events.push({
    type: "pause",
    timestamp: new Date()
  })

  // The session write and the task's Pending flip must land together — a crash between
  // the two would otherwise leave a paused session behind a task that still reads
  // "In Progress" (Engineering Standards §10: business-critical state changes must be
  // atomic where required).
  await runInTransaction(async (dbSession) => {
    await session.save({ session: dbSession })
    await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer paused", req.user.role, dbSession)
  })

  res.json({
    session,
    elapsedSeconds,
    isRunning: false
  })
})

export const resumeSession = asyncHandler(async (req, res, next) => {
  const session = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  }).populate("task", "title category status")

  if (!session) {
    return next(new AppError("No active work session running", 404))
  }

  const { elapsedSeconds, isRunning } = calculateSessionTime(session)
  if (isRunning) {
    return res.json({ session, elapsedSeconds, isRunning }) // Already running
  }

  session.events.push({
    type: "resume",
    timestamp: new Date()
  })

  await runInTransaction(async (dbSession) => {
    await session.save({ session: dbSession })
    await setTaskStatus(session.task._id, "In Progress", req.user.id, "Timer resumed", req.user.role, dbSession)
  })

  res.json({
    session,
    elapsedSeconds,
    isRunning: true
  })
})

export const stopSession = asyncHandler(async (req, res, next) => {
  const session = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  }).populate("task", "title category status")

  if (!session) {
    return next(new AppError("No active work session running", 404))
  }

  await runInTransaction(async (dbSession) => {
    await performStopSession(session, dbSession)
    await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer stopped", req.user.role, dbSession)
  })

  res.json({
    success: true,
    message: "Work session stopped successfully"
  })
})

// "Who is actively working on what, right now" — a manager sees their direct reports
// plus their own active session; super_admin sees the whole org. Distinct from a
// task's `status: "In Progress"` (which persists across pauses/switches) — this reads
// the live `stoppedAt: null` timer state directly, per the requirement to not conflate
// the two.
export const getActiveTeamSessions = asyncHandler(async (req, res) => {
  let employeeIds
  if (req.user.role === "manager") {
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    employeeIds = [...subordinates.map(s => s._id), req.user.id]
  } else {
    const allActive = await User.find({ isActive: true }).select("_id")
    employeeIds = allActive.map(u => u._id)
  }

  const sessions = await WorkSession.find({ employee: { $in: employeeIds }, stoppedAt: null })
    .populate("employee", "name role")
    .populate("task", "title")

  const activeWork = sessions.map(s => {
    const { elapsedSeconds, isRunning } = calculateSessionTime(s)
    return {
      _id: s._id,
      employee: s.employee,
      task: s.task,
      elapsedSeconds,
      isRunning
    }
  })

  res.json({ activeWork })
})

// ─── THE DAY-ATTRIBUTION RULE ────────────────────────────────────────────────
// A work session belongs entirely to the LOCAL DAY IT STARTED. It is never split
// across a midnight boundary, and never re-attributed to the day it ended.
//
// Chosen deliberately over the alternatives:
//   - Splitting a session at midnight is the most literally accurate, and would mean
//     slicing every pause/resume window per day inside the most safety-critical
//     calculation in the app, to serve a case a single-office team hits approximately
//     never. Accuracy nobody can check is not worth fragility everybody inherits.
//   - Attributing to the END day would move hours that were already reported.
// "I worked late Tuesday" reading as Tuesday's hours is also what people expect.
//
// KNOWN CONSEQUENCE, accepted: a timer started at 23:30 and still running at 00:30
// contributes NOTHING to today's figure — it is yesterday's session, in full. Someone
// working through midnight sees "0h today" beside a running clock. Correct by this
// rule, and surprising; if night work ever becomes normal here, that is the signal to
// revisit the choice rather than patch around it.
//
// Every consumer must apply the SAME rule or the totals stop reconciling:
// getTodayTrackedHours (below), the daily work-log prefill, and getProgressReport's
// date-filtered session aggregation all filter on `startedAt`.
export const getTodayTrackedHours = asyncHandler(async (req, res) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  // Sessions STARTED today — see the day-attribution rule above.
  const sessions = await WorkSession.find({
    employee: req.user.id,
    startedAt: { $gte: startOfDay }
  })

  let totalSecondsSum = 0
  for (const s of sessions) {
    if (s.stoppedAt) {
      totalSecondsSum += s.totalSeconds
    } else {
      const { elapsedSeconds } = calculateSessionTime(s)
      totalSecondsSum += elapsedSeconds
    }
  }

  const hoursWorked = Math.round((totalSecondsSum / 3600) * 100) / 100 // 2 decimals
  res.json({ hoursWorked })
})

