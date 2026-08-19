import mongoose from "mongoose"
import TaskTemplate from "../models/TaskTemplate.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import { provisionDailyTasksForAllEmployees } from "../services/dailyTaskService.js"

// Validated up front so bad input is rejected with a clear message here, at the point
// of entry, rather than surfacing as an opaque Mongoose CastError later during
// provisioning (dailyTaskService reads these arrays for every employee, every night).
const validateIdArray = (ids, label) => {
  if (!Array.isArray(ids)) return null
  const invalid = ids.filter(id => !mongoose.isValidObjectId(id))
  if (invalid.length > 0) return `Invalid ${label}: ${invalid.join(", ")}`
  return null
}

// Fire-and-forget: a manager saving a template shouldn't wait for provisioning to run
// across every employee before getting their response back. The `.catch` here is load
// -bearing, not decoration — an unhandled rejection on a promise nobody's awaiting would
// hit index.js's unhandledRejection handler and take the whole server down over a single
// employee's provisioning failing. dailyTaskService already logs and continues past
// per-employee failures; this only needs to catch a failure of the batch call itself.
const provisionInBackground = () => {
  provisionDailyTasksForAllEmployees()
    .catch(err => console.error("Background daily-task provisioning failed:", err.message))
}

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

  const deptError = scope === "department" ? validateIdArray(departments, "department IDs") : null
  if (deptError) return next(new AppError(deptError, 400, "INVALID_DEPARTMENTS"))
  const empError = scope === "employees" ? validateIdArray(employees, "employee IDs") : null
  if (empError) return next(new AppError(empError, 400, "INVALID_EMPLOYEES"))

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

  // Provision today's task from this template for every currently-eligible employee
  // right away, rather than waiting for each employee's next login / the midnight cron
  // (see services/dailyTaskService.js — same single source of truth for the logic).
  // Not awaited — see provisionInBackground's comment for why, and the tradeoff that
  // comes with it: the response below confirms the template is saved, not that
  // provisioning has finished. An employee whose dashboard is already open in-session
  // still won't see it appear live (no polling/websockets, unchanged from before) — it
  // surfaces on their next load either way, so this trades a slower "confirmed done"
  // response for a faster "confirmed queued" one without changing what the employee sees.
  provisionInBackground()

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
    if (template.scope === "department") {
      const deptError = validateIdArray(departments, "department IDs")
      if (deptError) return next(new AppError(deptError, 400, "INVALID_DEPARTMENTS"))
    }
    template.departments = (template.scope === "department" && Array.isArray(departments)) ? departments : []
  }
  if (employees !== undefined) {
    if (template.scope === "employees") {
      const empError = validateIdArray(employees, "employee IDs")
      if (empError) return next(new AppError(empError, 400, "INVALID_EMPLOYEES"))
    }
    template.employees = (template.scope === "employees" && Array.isArray(employees)) ? employees : []
  }
  if (isActive !== undefined) template.isActive = isActive

  await template.save()

  // Same immediate-provisioning as create, and same fire-and-forget reasoning: an edit
  // that (re)activates a template, or widens/changes who it applies to, should still
  // kick off today's task right away without making the save wait on it.
  if (template.isActive) {
    provisionInBackground()
  }

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
