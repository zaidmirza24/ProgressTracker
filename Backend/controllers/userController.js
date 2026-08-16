import bcrypt from "bcryptjs"
import User from "../models/User.js"
import Task from "../models/Task.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { stopActiveSessionForEmployee } from "../services/taskService.js"

const populateFields = "name email role department team manager isActive createdAt dailyWorkingHours breakHours"

export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({ isActive: true })
    .select(populateFields)
    .populate("department", "name")
    .populate("team", "name")
    .populate("manager", "name email")
    .sort({ role: 1, name: 1 })
  res.json({ users })
})

export const createUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, role, department, team, manager, dailyWorkingHours, breakHours } = req.body
  if (!name || !email || !password || !role) {
    return next(new AppError("name, email, password, and role are required", 400))
  }
  if (password.length < 6) {
    return next(new AppError("Password must be at least 6 characters", 400))
  }
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await User.create({
    name, email, passwordHash, role,
    department: department || null,
    team: team || null,
    manager: manager || null,
    ...(dailyWorkingHours !== undefined && { dailyWorkingHours }),
    ...(breakHours !== undefined && { breakHours })
  })
  const populated = await User.findById(user._id)
    .select(populateFields)
    .populate("department", "name")
    .populate("team", "name")
    .populate("manager", "name email")
  res.status(201).json({ user: populated })
})

export const updateUser = asyncHandler(async (req, res, next) => {
  const { name, email, role, department, team, manager, dailyWorkingHours, breakHours } = req.body
  if (!name || !email || !role) {
    return next(new AppError("name, email, and role are required", 400))
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { name, email, role,
      department: department || null,
      team: team || null,
      manager: manager || null,
      ...(dailyWorkingHours !== undefined && { dailyWorkingHours }),
      ...(breakHours !== undefined && { breakHours })
    },
    { new: true }
  ).select(populateFields)
    .populate("department", "name")
    .populate("team", "name")
    .populate("manager", "name email")
  if (!user) return next(new AppError("User not found", 404))
  res.json({ user })
})

// ─── PATCH /api/users/:id/deactivate ──────────────────────────────────────────
// Soft-delete (Core Rule 2 — never hard-delete a user). `isActive: false` already
// removes them from every list, report, capacity calculation and daily-task
// provisioning run, because every query filters on it. This was the missing caller:
// the field has existed since day one and nothing ever set it.
export const deactivateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params
  const { reassignTo } = req.body

  if (id === req.user.id) {
    return next(new AppError("You cannot deactivate your own account", 400, "CANNOT_DEACTIVATE_SELF"))
  }

  const user = await User.findById(id)
  if (!user || !user.isActive) {
    return next(new AppError("User not found", 404, "USER_NOT_FOUND"))
  }

  // Open work would otherwise be stranded: invisible in every list (the assignee is
  // gone from the employee set) but still counted in org-wide task totals.
  const openTasks = await Task.find({
    assignedTo: id,
    isActive: true,
    status: { $ne: "Completed" }
  }).select("_id title isDaily")

  const openAssigned = openTasks.filter(t => !t.isDaily)

  if (openAssigned.length > 0 && !reassignTo) {
    return next(new AppError(
      `${user.name} still has ${openAssigned.length} open task${openAssigned.length === 1 ? "" : "s"}. Choose someone to take them over first.`,
      409,
      "HAS_OPEN_TASKS"
    ))
  }

  if (openAssigned.length > 0) {
    const target = await User.findById(reassignTo).select("name isActive")
    if (!target || !target.isActive) {
      return next(new AppError("The person taking over must be an active user", 400, "INVALID_REASSIGN_TARGET"))
    }
    if (target._id.toString() === id) {
      return next(new AppError("Tasks cannot be reassigned to the person being deactivated", 400, "INVALID_REASSIGN_TARGET"))
    }

    for (const task of openAssigned) {
      const doc = await Task.findById(task._id)
      doc.assignedTo = target._id
      if (doc.status === "In Progress") doc.status = "Pending"
      doc.history.push({
        changes: [{ field: "assignedTo", from: user.name, to: target.name }],
        changedBy: req.user.id,
        comment: `Reassigned automatically — ${user.name} was deactivated`
      })
      await doc.save()
    }
  }

  // Daily tasks are template-derived and belong to this person; they simply stop being
  // provisioned once the user is inactive. Soft-delete today's open ones so they don't
  // linger in org-wide counts.
  const openDaily = openTasks.filter(t => t.isDaily)
  for (const t of openDaily) {
    await Task.findByIdAndUpdate(t._id, {
      isActive: false,
      $push: {
        history: {
          changes: [{ field: "isActive", from: "active", to: "cancelled" }],
          changedBy: req.user.id,
          comment: `Cancelled automatically — ${user.name} was deactivated`
        }
      }
    })
  }

  // Any running timer must be closed out, or it accrues forever against a departed user.
  await stopActiveSessionForEmployee(id)

  // Direct reports would otherwise point at an inactive manager and silently drop out
  // of that manager's scope with no new one.
  const orphaned = await User.updateMany({ manager: id, isActive: true }, { manager: null })

  user.isActive = false
  await user.save()

  res.json({
    success: true,
    message: `${user.name} has been deactivated`,
    reassignedTasks: openAssigned.length,
    cancelledDailyTasks: openDaily.length,
    orphanedReports: orphaned.modifiedCount
  })
})
