import TaskTemplate from "../models/TaskTemplate.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

// GET /api/task-templates — list all (admin only)
export const getTemplates = asyncHandler(async (req, res) => {
  const templates = await TaskTemplate.find({ isActive: true })
    .populate("departments", "name")
    .populate("employees", "name email department")
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
  res.json({ templates })
})

// POST /api/task-templates — create template
export const createTemplate = asyncHandler(async (req, res, next) => {
  const { title, description, category, priority, estimatedHours, scope, departments, employees } = req.body
  if (!title) return next(new AppError("Title is required", 400))

  const template = await TaskTemplate.create({
    title,
    description: description || "",
    category: category || "Daily",
    priority: priority || "medium",
    estimatedHours: estimatedHours || 1,
    scope: scope || "global",
    departments: (scope === "department" && Array.isArray(departments)) ? departments : [],
    employees: (scope === "employees" && Array.isArray(employees)) ? employees : [],
    createdBy: req.user.id
  })

  const populated = await TaskTemplate.findById(template._id)
    .populate("departments", "name")
    .populate("employees", "name email department")
    .populate("createdBy", "name email")

  res.status(201).json({ template: populated })
})

// PUT /api/task-templates/:id — update template
export const updateTemplate = asyncHandler(async (req, res, next) => {
  const { title, description, category, priority, estimatedHours, scope, departments, employees, isActive } = req.body
  const template = await TaskTemplate.findById(req.params.id)
  if (!template) return next(new AppError("Template not found", 404))

  if (title !== undefined) template.title = title
  if (description !== undefined) template.description = description
  if (category !== undefined) template.category = category
  if (priority !== undefined) template.priority = priority
  if (estimatedHours !== undefined) template.estimatedHours = estimatedHours
  if (scope !== undefined) {
    template.scope = scope
  }
  if (departments !== undefined) {
    template.departments = (template.scope === "department" && Array.isArray(departments)) ? departments : []
  }
  if (employees !== undefined) {
    template.employees = (template.scope === "employees" && Array.isArray(employees)) ? employees : []
  }
  if (isActive !== undefined) template.isActive = isActive

  await template.save()

  const populated = await TaskTemplate.findById(template._id)
    .populate("departments", "name")
    .populate("employees", "name email department")
    .populate("createdBy", "name email")

  res.json({ template: populated })
})

// DELETE /api/task-templates/:id — soft delete
export const deleteTemplate = asyncHandler(async (req, res, next) => {
  const template = await TaskTemplate.findById(req.params.id)
  if (!template) return next(new AppError("Template not found", 404))
  template.isActive = false
  await template.save()
  res.json({ success: true, message: "Template deactivated" })
})
