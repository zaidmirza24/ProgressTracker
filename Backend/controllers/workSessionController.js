import WorkSession from "../models/WorkSession.js"
import Task from "../models/Task.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

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
const setTaskStatus = async (taskId, toStatus, changedBy, comment) => {
  const task = await Task.findById(taskId)
  if (!task || task.status === toStatus) return
  const fromStatus = task.status
  if (fromStatus !== "In Progress" && toStatus !== "In Progress") return
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

  // 1. Stop any currently active timer for this employee
  const activeSession = await WorkSession.findOne({
    employee: req.user.id,
    stoppedAt: null
  })

  if (activeSession) {
    await performStopSession(activeSession)
    // Switching tasks pauses the previous one — it falls back to Pending
    await setTaskStatus(activeSession.task, "Pending", req.user.id, "Switched to another task")
  }

  // 2. Create the new work session
  const session = await WorkSession.create({
    task: taskId,
    employee: req.user.id,
    startedAt: new Date()
  })

  // 3. Update task status to "In Progress" if it is Not Started or Pending
  const task = await Task.findById(taskId)
  if (task && ["Not Started", "Pending"].includes(task.status)) {
    task.history.push({ fromStatus: task.status, toStatus: "In Progress", changedBy: req.user.id, comment: "Timer started" })
    task.status = "In Progress"
    task.progressPercentage = 50
    await task.save()
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
  await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer paused")

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
  await setTaskStatus(session.task._id, "In Progress", req.user.id, "Timer resumed")

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
  await setTaskStatus(session.task._id, "Pending", req.user.id, "Timer stopped")

  res.json({
    success: true,
    message: "Work session stopped successfully"
  })
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

