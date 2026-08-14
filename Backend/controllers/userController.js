import bcrypt from "bcryptjs"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

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
