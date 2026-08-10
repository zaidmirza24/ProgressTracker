import DailyWorkLog from "../models/DailyWorkLog.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

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

export const createLog = asyncHandler(async (req, res, next) => {
  const { todaysWork, hoursWorked, tasksCompleted, problemsFaced, nextPlan, remarks } = req.body

  if (!todaysWork || hoursWorked === undefined) {
    return next(new AppError("todaysWork and hoursWorked are required", 400))
  }

  const log = await DailyWorkLog.create({
    employee: req.user.id,
    date: new Date(),
    todaysWork,
    hoursWorked,
    tasksCompleted: tasksCompleted || "",
    problemsFaced: problemsFaced || "",
    nextPlan: nextPlan || "",
    remarks: remarks || ""
  })

  const populatedLog = await DailyWorkLog.findById(log._id)
    .populate("employee", "name email role")

  res.status(201).json({ log: populatedLog })
})
