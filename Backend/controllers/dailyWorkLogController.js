import DailyWorkLog from "../models/DailyWorkLog.js"
import User from "../models/User.js"
import Task from "../models/Task.js"
import WorkSession from "../models/WorkSession.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { calculateSessionElapsedSeconds } from "../services/taskService.js"

const dayBounds = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

export const getLogs = asyncHandler(async (req, res) => {
  let filter = {}

  if (req.user.role === "employee") {
    // Employees see only their own logs
    filter.employee = req.user.id
  } else if (req.user.role === "manager") {
    // Managers see logs of their subordinates
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    const subordinateIds = subordinates.map(sub => sub._id)

    if (req.query.employee) {
      // Ensure the queried employee reports to this manager
      if (!subordinateIds.some(id => id.toString() === req.query.employee)) {
        return res.json({ logs: [] }) // Or return error; let's return empty array safely
      }
      filter.employee = req.query.employee
    } else {
      filter.employee = { $in: subordinateIds }
    }
  } else if (req.user.role === "super_admin") {
    // Super Admin sees all logs
    if (req.query.employee) {
      filter.employee = req.query.employee
    }
  }

  const logs = await DailyWorkLog.find(filter)
    .populate("employee", "name email role")
    .sort({ date: -1, createdAt: -1 })

  res.json({ logs })
})

// ─── GET /api/daily-work-logs/today-context ──────────────────────────────────
// Everything needed to stop the log being duplicate data entry.
//
// For an employee: the tasks they ACTUALLY completed today and the hours actually
// tracked, so the form is a review-and-confirm rather than a retype — the system
// already knows both.
//
// For a manager/admin: who has and hasn't submitted today. An unenforced daily ritual
// with no compliance view quietly stops happening.
export const getTodayContext = asyncHandler(async (req, res) => {
  const { start, end } = dayBounds()

  if (req.user.role === "employee") {
    const completedToday = await Task.find({
      assignedTo: req.user.id,
      isActive: true,
      status: "Completed",
      updatedAt: { $gte: start, $lt: end }
    }).select("title category").lean()

    const sessions = await WorkSession.find({ employee: req.user.id, startedAt: { $gte: start } })
    const trackedSeconds = sessions.reduce(
      (sum, s) => sum + (s.stoppedAt ? s.totalSeconds : calculateSessionElapsedSeconds(s)), 0
    )

    const existing = await DailyWorkLog.findOne({ employee: req.user.id, date: { $gte: start, $lt: end } })

    return res.json({
      completedToday: completedToday.map(t => ({ _id: t._id, title: t.title })),
      trackedHours: Math.round((trackedSeconds / 3600) * 100) / 100,
      alreadySubmitted: Boolean(existing)
    })
  }

  // Manager sees their own reports; super_admin the whole org.
  const userFilter = { isActive: true, role: "employee" }
  if (req.user.role === "manager") userFilter.manager = req.user.id
  const employees = await User.find(userFilter).select("name email").lean()

  const logs = await DailyWorkLog.find({
    employee: { $in: employees.map(e => e._id) },
    date: { $gte: start, $lt: end }
  }).select("employee").lean()

  const submittedIds = new Set(logs.map(l => l.employee.toString()))
  res.json({
    total: employees.length,
    submitted: employees.filter(e => submittedIds.has(e._id.toString())),
    missing: employees.filter(e => !submittedIds.has(e._id.toString()))
  })
})

export const createLog = asyncHandler(async (req, res, next) => {
  const { todaysWork, hoursWorked, tasksCompleted, problemsFaced, nextPlan, remarks } = req.body

  if (!todaysWork || hoursWorked === undefined) {
    return next(new AppError("todaysWork and hoursWorked are required", 400))
  }

  const hours = Number(hoursWorked)
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
    return next(new AppError("Hours worked must be a number between 0 and 24", 400, "INVALID_HOURS"))
  }

  // One log per person per day. Enforced here rather than with a unique index because
  // `date` carries a time component, so a plain index wouldn't collapse to the day.
  const { start, end } = dayBounds()
  const existing = await DailyWorkLog.findOne({ employee: req.user.id, date: { $gte: start, $lt: end } })
  if (existing) {
    return next(new AppError("You have already submitted a work log for today", 409, "LOG_ALREADY_SUBMITTED"))
  }

  const log = await DailyWorkLog.create({
    employee: req.user.id,
    date: new Date(),
    todaysWork,
    hoursWorked: hours,
    tasksCompleted: tasksCompleted || "",
    problemsFaced: problemsFaced || "",
    nextPlan: nextPlan || "",
    remarks: remarks || ""
  })

  const populatedLog = await DailyWorkLog.findById(log._id)
    .populate("employee", "name email role")

  res.status(201).json({ log: populatedLog })
})
