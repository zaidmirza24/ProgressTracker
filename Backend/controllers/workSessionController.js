import WorkSession from "../models/WorkSession.js"
import Task from "../models/Task.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { startSessionForTask } from "../services/taskService.js"
import { isValidTransition } from "../config/workflow.js"

// Helper to check if session is running and calculate current elapsed seconds
const calculateSessionTime = (session) => {
  if (!session) return { elapsedSeconds: 0, isRunning: false }

  const events = session.events
  if (events.length === 0) {
    // Session is running since startedAt
    const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000
    return {
      elapsedSeconds: Math.max(0, Math.floor(elapsed)),
      isRunning: true
    }
  }

  const lastEvent = events[events.length - 1]
  if (lastEvent.type === "pause") {
    // Session is currently paused
    return {
      elapsedSeconds: Math.floor(session.totalSeconds),
      isRunning: false
    }
  } else {
    // Session is running since last resume event
    const elapsed = session.totalSeconds + (Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000
    return {
      elapsedSeconds: Math.max(0, Math.floor(elapsed)),
      isRunning: true
    }
  }
}

// Helper to stop an active session
const performStopSession = async (session) => {
  const { elapsedSeconds } = calculateSessionTime(session)
  session.totalSeconds = elapsedSeconds
  session.stoppedAt = new Date()
  await session.save()
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
const setTaskStatus = async (taskId, toStatus, changedBy, comment, role) => {
  const task = await Task.findById(taskId)
  if (!task) return

  const unblocked = toStatus === "In Progress" && clearBlockedIfSet(task, changedBy)

  if (task.status === toStatus) {
    if (unblocked) await task.save()
    return
  }
  const fromStatus = task.status
  const isSelfAssigned = task.assignedBy.toString() === task.assignedTo.toString()
  if (!isValidTransition(role, isSelfAssigned, fromStatus, toStatus)) {
    if (unblocked) await task.save()
    return
  }
  task.status = toStatus
  task.progressPercentage = toStatus === "In Progress" ? 50 : task.progressPercentage
  task.history.push({ fromStatus, toStatus, changedBy, comment })
  await task.save()
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

  // 1. Stop any currently active timer for this employee, and record which task it was
  //    on so its status can fall back to Pending (switching tasks pauses the previous one).
  const activeSession = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  })
  const previousTaskId = activeSession?.task

  // 2. Stop-then-create is race-safe: see startSessionForTask's doc comment for how
  //    concurrent start requests converge instead of creating two active sessions.
  const session = await startSessionForTask(taskId, req.user.id)

  if (previousTaskId && previousTaskId.toString() !== taskId) {
    await setTaskStatus(previousTaskId, "Pending", req.user.id, "Switched to another task", req.user.role)
  }

  // 3. Confirm this call's session actually still holds the employee's single
  //    active-timer slot before reflecting "In Progress" on the task. A concurrent
  //    startSession call for a DIFFERENT task can have already stopped this session
  //    in the stop-then-create race (see startSessionForTask's doc comment) — without
  //    this check, this task would get stamped "In Progress" with no timer actually
  //    running behind it, and nothing would ever revert it.
  const wonTimerRace = await WorkSession.exists({ _id: session._id, stoppedAt: null })

  // Update task status to "In Progress" if the transition is valid (per the same
  // config/workflow.js rules PUT /:id/status uses), and clear any block — starting
  // the timer is proof the work can proceed.
  const isSelfAssigned = targetTask.assignedBy.toString() === targetTask.assignedTo.toString()
  const canStart = targetTask.status !== "In Progress" &&
    isValidTransition(req.user.role, isSelfAssigned, targetTask.status, "In Progress")
  const wasUnblocked = clearBlockedIfSet(targetTask, req.user.id)
  if (wonTimerRace && canStart) {
    targetTask.history.push({ fromStatus: targetTask.status, toStatus: "In Progress", changedBy: req.user.id, comment: "Timer started" })
    targetTask.status = "In Progress"
    targetTask.progressPercentage = 50
    await targetTask.save()
  } else if (wasUnblocked) {
    await targetTask.save()
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

  await session.save()
  await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer paused", req.user.role)

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

  await session.save()
  await setTaskStatus(session.task._id, "In Progress", req.user.id, "Timer resumed", req.user.role)

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

  await performStopSession(session)
  await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer stopped", req.user.role)

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

export const getTodayTrackedHours = asyncHandler(async (req, res) => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  // Find all sessions started today
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

