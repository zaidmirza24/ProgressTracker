import mongoose from "mongoose"
import Team from "../models/Team.js"
import Department from "../models/Department.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

export const getTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ isActive: true })
    .populate("department", "name")
    .sort({ name: 1 })
  res.json({ teams })
})

// Explicit field-level checks instead of relying on Mongoose's `required`/`trim` to
// reject bad input — matches the validation style used elsewhere (e.g. taskController's
// updateTask) and gives a clear, field-specific error instead of a generic 400.
const validateTeamInput = async (name, department, description) => {
  if (!name || !String(name).trim()) return "Team name is required"
  if (String(name).trim().length > 100) return "Team name cannot exceed 100 characters"
  if (!department || !mongoose.isValidObjectId(department)) return "A valid department is required"
  if (!(await Department.exists({ _id: department, isActive: true }))) return "Department not found"
  if (description !== undefined && description !== null && String(description).length > 500) {
    return "Description cannot exceed 500 characters"
  }
  return null
}

export const createTeam = asyncHandler(async (req, res, next) => {
  const { name, department, description } = req.body
  const error = await validateTeamInput(name, department, description)
  if (error) return next(new AppError(error, 400, "INVALID_TEAM"))

  const team = await Team.create({ name: String(name).trim(), department, description: description ? String(description).trim() : "" })
  await team.populate("department", "name")
  res.status(201).json({ team })
})

export const updateTeam = asyncHandler(async (req, res, next) => {
  const { name, department, description } = req.body
  const error = await validateTeamInput(name, department, description)
  if (error) return next(new AppError(error, 400, "INVALID_TEAM"))

  const existingTeam = await Team.findById(req.params.id).select("department")
  if (!existingTeam) return next(new AppError("Team not found", 404))
  const departmentChanged = existingTeam.department.toString() !== String(department)

  const team = await Team.findByIdAndUpdate(
    req.params.id,
    { name: String(name).trim(), department, description: description ? String(description).trim() : "" },
    { new: true, runValidators: true }
  ).populate("department", "name")

  // Keep members' own `department` field consistent with the team they're on — without
  // this, moving a team to a new department leaves its members silently pointing at the
  // old one (Standards §29: one data change shouldn't leave a dependent area stale).
  let membersUpdated = 0
  if (departmentChanged) {
    const result = await User.updateMany({ team: req.params.id, isActive: true }, { department })
    membersUpdated = result.modifiedCount
  }

  res.json({ team, ...(departmentChanged && { membersUpdated }) })
})

// Soft-delete (Core Rule 2). Refuses to strand active Users still on this team —
// same "resolve references before deactivating" shape as userController.deactivateUser.
export const deactivateTeam = asyncHandler(async (req, res, next) => {
  const { id } = req.params

  const team = await Team.findById(id)
  if (!team || !team.isActive) {
    return next(new AppError("Team not found", 404, "TEAM_NOT_FOUND"))
  }

  const activeUserCount = await User.countDocuments({ team: id, isActive: true })
  if (activeUserCount > 0) {
    return next(new AppError(
      `Cannot deactivate: ${activeUserCount} active user(s) are still on this team. Move them to another team first.`,
      409,
      "TEAM_IN_USE"
    ))
  }

  team.isActive = false
  await team.save()
  res.json({ success: true, message: "Team deactivated", teamId: team._id })
})
