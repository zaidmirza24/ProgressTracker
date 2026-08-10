import Department from "../models/Department.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

export const getDepartments = asyncHandler(async (req, res) => {
  const departments = await Department.find({ isActive: true }).sort({ name: 1 })
  res.json({ departments })
})

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description } = req.body
  const department = await Department.create({ name, description })
  res.status(201).json({ department })
})

export const updateDepartment = asyncHandler(async (req, res, next) => {
  const { name, description } = req.body
  const department = await Department.findByIdAndUpdate(
    req.params.id,
    { name, description },
    { new: true }
  )
  if (!department) return next(new AppError("Department not found", 404))
  res.json({ department })
})
