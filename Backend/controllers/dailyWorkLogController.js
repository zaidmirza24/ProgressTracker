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
    // A manager sees their direct reports' logs AND their own — they now write one too,
    // and a page that hid your own submission from you would be plainly odd.
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    const visibleIds = [...subordinates.map(sub => sub._id.toString()), req.user.id]

    if (req.query.employee) {
      // Asking for a specific person must still respect scope.
      if (!visibleIds.includes(req.query.employee)) {
        return res.json({ logs: [] })
      }
      filter.employee = req.query.employee
    } else {
      filter.employee = { $in: visibleIds }
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

  // Everyone gets their OWN context — what they finished today, what they tracked, and
  // whether they have already submitted. Management additionally gets the compliance
  // view below. The response is additive rather than branching on role, so a manager
  // now receives both and existing consumers of either half are unaffected.
  const buildOwnContext = async () => {
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

    return {
      completedToday: completedToday.map(t => ({ _id: t._id, title: t.title })),
      trackedHours: Math.round((trackedSeconds / 3600) * 100) / 100,
      alreadySubmitted: Boolean(existing)
    }
  }

  const own = await buildOwnContext()

  if (req.user.role === "employee") {
    return res.json(own)
  }

  // ── Compliance: whose submission is this caller responsible for chasing? ─────
  //
  // Deliberately NOT the same question as "who may submit". A manager chases their own
  // reports, not themselves; an admin chases employees and managers alike. Keeping the
  // caller out of their own missing-list is the point — their own status is in `own`
  // above.
  const userFilter = { isActive: true, _id: { $ne: req.user.id } }
  if (req.user.role === "manager") {
    userFilter.role = "employee"
    userFilter.manager = req.user.id
  } else {
    userFilter.role = { $in: ["employee", "manager"] }
  }
  const people = await User.find(userFilter).select("name email role").lean()

  const logs = await DailyWorkLog.find({
    employee: { $in: people.map(e => e._id) },
    date: { $gte: start, $lt: end }
  }).select("employee").lean()

  const submittedIds = new Set(logs.map(l => l.employee.toString()))
  res.json({
    ...own,
    total: people.length,
    submitted: people.filter(e => submittedIds.has(e._id.toString())),
    missing: people.filter(e => !submittedIds.has(e._id.toString()))
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

  // One log per person per day. This pre-check is a fast, friendly rejection for the
  // common case, not the actual guard — two concurrent submissions can both pass it
  // before either commits. The real guard is the unique index on {employee, logDate}
  // below, which MongoDB enforces atomically.
  const { start, end } = dayBounds()
  const existing = await DailyWorkLog.findOne({ employee: req.user.id, date: { $gte: start, $lt: end } })
  if (existing) {
    return next(new AppError("You have already submitted a work log for today", 409, "LOG_ALREADY_SUBMITTED"))
  }

  let log
  try {
    log = await DailyWorkLog.create({
      employee: req.user.id,
      date: new Date(),
      logDate: start,
      todaysWork,
      hoursWorked: hours,
      tasksCompleted: tasksCompleted || "",
      problemsFaced: problemsFaced || "",
      nextPlan: nextPlan || "",
      remarks: remarks || ""
    })
  } catch (err) {
    if (err.code === 11000) {
      return next(new AppError("You have already submitted a work log for today", 409, "LOG_ALREADY_SUBMITTED"))
    }
    throw err
  }

  const populatedLog = await DailyWorkLog.findById(log._id)
    .populate("employee", "name email role")

  res.status(201).json({ log: populatedLog })
})
