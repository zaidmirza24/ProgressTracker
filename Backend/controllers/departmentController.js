import Department from "../models/Department.js"
import Team from "../models/Team.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true }).sort({ name: 1 })
  res.json({ departments })
})

// Explicit field-level checks instead of relying on Mongoose's `required`/`trim` to
// reject bad input — matches the validation style used elsewhere (e.g. taskController's
// updateTask) and gives a clear, field-specific error instead of a generic 400.
const validateDepartmentInput = (name, description) => {
  if (!name || !String(name).trim()) return "Department name is required"
  if (String(name).trim().length > 100) return "Department name cannot exceed 100 characters"
  if (description !== undefined && description !== null && String(description).length > 500) {
    return "Description cannot exceed 500 characters"
  }
  return null
}

export const createDepartment = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body
  const error = validateDepartmentInput(name, description)
  if (error) return next(new AppError(error, 400, "INVALID_DEPARTMENT"))

  const department = await Department.create({ name: String(name).trim(), description: description ? String(description).trim() : "" })
  res.status(201).json({ department })
})

export const updateDepartment = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body
  const error = validateDepartmentInput(name, description)
  if (error) return next(new AppError(error, 400, "INVALID_DEPARTMENT"))

  const department = await Department.findByIdAndUpdate(
    req.params.id,
    { name: String(name).trim(), description: description ? String(description).trim() : "" },
    { new: true, runValidators: true }
  )
  if (!department) return next(new AppError("Department not found", 404))
  res.json({ department })
})

// Soft-delete (Core Rule 2). Refuses to strand active Teams/Users pointing at this
// department — same "resolve references before deactivating" shape as
// userController.deactivateUser, just without a reassignment flow: an admin retiring
// a department is expected to have already migrated or wound down what's under it.
export const deactivateDepartment = asyncHandler(async (req, res, next) => {
  const { id } = req.params

  const department = await Department.findById(id)
  if (!department || !department.isActive) {
    return next(new AppError("Department not found", 404, "DEPARTMENT_NOT_FOUND"))
  }

  const [activeTeamCount, activeUserCount] = await Promise.all([
    Team.countDocuments({ department: id, isActive: true }),
    User.countDocuments({ department: id, isActive: true })
  ])
  if (activeTeamCount > 0 || activeUserCount > 0) {
    return next(new AppError(
      `Cannot deactivate: ${activeTeamCount} active team(s) and ${activeUserCount} active user(s) still belong to this department. Move or deactivate them first.`,
      409,
      "DEPARTMENT_IN_USE"
    ))
  }

  department.isActive = false
  await department.save()
  res.json({ success: true, message: "Department deactivated", departmentId: department._id })
})
