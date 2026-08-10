import Task from "../models/Task.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

// Get progress defaults based on status
const getProgressForStatus = (status) => {
  switch (status) {
    case "Not Started": return 0
    case "Accepted": return 10
    case "In Progress": return 50
    case "Waiting for Review": return 90
    case "Completed":
    case "Approved": return 100
    case "Rejected": return 50
    case "Reopened": return 10
    default: return 0
  }
}

export const getTasks = asyncHandler(async (req, res) => {
  let filter = { isActive: true }

  if (req.user.role === "manager") {
    // Managers see tasks they assigned, or tasks assigned to employees reporting to them
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    const subordinateIds = subordinates.map(sub => sub._id)
    filter.$or = [
      { assignedBy: req.user.id },
      { assignedTo: req.user.id },
      { assignedTo: { $in: subordinateIds } }
    ]
  } else if (req.user.role === "employee") {
    // Employees see tasks assigned to them
    filter.assignedTo = req.user.id
  }

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .sort({ updatedAt: -1 })

  res.json({ tasks })
})

export const createTask = asyncHandler(async (req, res, next) => {
  const { title, description, category, department, assignedTo, priority, estimatedHours, dueDate } = req.body

  const targetAssignedTo = req.user.role === "employee" ? req.user.id : assignedTo

  if (!title || !targetAssignedTo) {
    return next(new AppError("Title and assignedTo fields are required", 400))
  }

  const task = await Task.create({
    title,
    description,
    category: category || "General",
    department: department || null,
    assignedBy: req.user.id,
    assignedTo: targetAssignedTo,
    priority: priority || "medium",
    estimatedHours: estimatedHours || 0,
    dueDate: dueDate || null,
    status: "Not Started",
    progressPercentage: 0
  })

  const populatedTask = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")

  res.status(201).json({ task: populatedTask })
})

export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  const { status, comment } = req.body
  const { id } = req.params

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404))
  }

  let finalStatus = status
  // If the task is self-assigned, and it is transitioned to Waiting for Review, direct complete to Completed
  if (task.assignedBy.toString() === task.assignedTo.toString() && status === "Waiting for Review") {
    finalStatus = "Completed"
  }

  // Update status and default progress
  task.status = finalStatus
  task.progressPercentage = getProgressForStatus(finalStatus)

  // Append optional transition comment
  if (comment && comment.trim()) {
    task.comments.push({
      text: comment.trim(),
      author: req.user.id
    })
  }

  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")

  res.json({ task: populatedTask })
})

export const addComment = asyncHandler(async (req, res, next) => {
  const { text } = req.body
  const { id } = req.params

  if (!text || !text.trim()) {
    return next(new AppError("Comment text is required", 400))
  }

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404))
  }

  task.comments.push({
    text: text.trim(),
    author: req.user.id
  })

  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")

  res.json({ task: populatedTask })
})
