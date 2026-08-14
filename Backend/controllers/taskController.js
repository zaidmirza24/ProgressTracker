import Task from "../models/Task.js"
import User from "../models/User.js"
import WorkSession from "../models/WorkSession.js"
import TaskTemplate from "../models/TaskTemplate.js"
import { isValidTransition } from "../config/workflow.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calculate elapsed seconds for a single in-progress work session
const calculateSessionSeconds = (session) => {
  if (!session) return 0
  const events = session.events
  if (events.length === 0) {
    const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000
    return Math.max(0, Math.floor(elapsed))
  }
  const lastEvent = events[events.length - 1]
  if (lastEvent.type === "pause") {
    return Math.floor(session.totalSeconds)
  }
  const elapsed = session.totalSeconds + (Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000
  return Math.max(0, Math.floor(elapsed))
}

// PERFORMANCE FIX: Batch-aggregate tracked seconds for multiple tasks in one DB query
const attachTrackedSecondsToTasks = async (taskObjects) => {
  const taskIds = taskObjects.map(t => t._id)

  // Sum completed sessions per task
  const sessionAgg = await WorkSession.aggregate([
    { $match: { task: { $in: taskIds }, stoppedAt: { $ne: null } } },
    { $group: { _id: "$task", totalStopped: { $sum: "$totalSeconds" } } }
  ])

  // Find active (unstoppped) sessions
  const activeSessions = await WorkSession.find({ task: { $in: taskIds }, stoppedAt: null })

  // Build lookup maps
  const stoppedMap = {}
  sessionAgg.forEach(s => { stoppedMap[s._id.toString()] = s.totalStopped })

  const activeMap = {}
  activeSessions.forEach(s => { activeMap[s.task.toString()] = calculateSessionSeconds(s) })

  return taskObjects.map(t => {
    const id = t._id.toString()
    const totalTrackedSeconds = (stoppedMap[id] || 0) + (activeMap[id] || 0)
    return { ...t, totalTrackedSeconds, ...computeOverrunFields(t.estimatedHours, totalTrackedSeconds) }
  })
}

// Attach tracked time to a single task (still needed for status update / add comment responses)
const getTaskWithTime = async (task) => {
  const sessions = await WorkSession.find({ task: task._id })
  let totalTrackedSeconds = 0
  for (const s of sessions) {
    totalTrackedSeconds += s.stoppedAt ? s.totalSeconds : calculateSessionSeconds(s)
  }
  const tObj = task.toObject ? task.toObject() : task
  tObj.totalTrackedSeconds = totalTrackedSeconds
  Object.assign(tObj, computeOverrunFields(tObj.estimatedHours, totalTrackedSeconds))
  return tObj
}

// Compute Estimated vs Actual variance/overrun fields (Locked Logic §5)
const computeOverrunFields = (estimatedHours, totalTrackedSeconds) => {
  const estimatedSeconds = (estimatedHours || 0) * 3600
  const timeVarianceSeconds = totalTrackedSeconds - estimatedSeconds
  const overrunPercentage = estimatedSeconds > 0
    ? Math.round((timeVarianceSeconds / estimatedSeconds) * 100)
    : 0
  const isOverrun = estimatedSeconds > 0 && timeVarianceSeconds > 0
  return { timeVarianceSeconds, overrunPercentage, isOverrun }
}

// Estimation pattern detection (Locked Logic §10) — a majority of the last few
// completed+estimated tasks overrunning is a signal worth surfacing, never punitive.
const PATTERN_LOOKBACK = 5
const PATTERN_MIN_SAMPLE = 3
const PATTERN_THRESHOLD = 0.5

const isSameCalendarDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Days a task has been sitting in Pending, using the last transition into Pending
// (Locked Logic §8 — track how long each task has sat pending). Falls back to
// updatedAt if no matching history entry exists.
const getPendingAgeDays = (task) => {
  if (task.status !== "Pending") return null
  const lastPendingEntry = [...(task.history || [])].reverse().find(h => h.toStatus === "Pending")
  const since = lastPendingEntry ? new Date(lastPendingEntry.timestamp) : new Date(task.updatedAt)
  return Math.max(0, (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24))
}

// Map status → default progress %
const getProgressForStatus = (status) => {
  switch (status) {
    case "Not Started": return 0
    case "In Progress": return 50
    case "Pending": return 50
    case "In Review": return 90
    case "Completed": return 100
    default: return 0
  }
}

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
export const getTasks = asyncHandler(async (req, res) => {
  let filter = { isActive: true }

  if (req.user.role === "manager") {
    const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
    const subordinateIds = subordinates.map(s => s._id)
    filter.$or = [
      { assignedBy: req.user.id },
      { assignedTo: req.user.id },
      { assignedTo: { $in: subordinateIds } }
    ]
  } else if (req.user.role === "employee") {
    filter.assignedTo = req.user.id
  }

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")
    .sort({ isDaily: -1, updatedAt: -1 }) // Daily tasks appear first

  const taskPlainObjects = tasks.map(t => t.toObject())
  const tasksWithTime = await attachTrackedSecondsToTasks(taskPlainObjects)

  res.json({ tasks: tasksWithTime })
})

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
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

  res.status(201).json({ task: { ...populatedTask.toObject(), totalTrackedSeconds: 0, ...computeOverrunFields(populatedTask.estimatedHours, 0) } })
})

// ─── PUT /api/tasks/:id/status ────────────────────────────────────────────────
export const updateTaskStatus = asyncHandler(async (req, res, next) => {
  const { status, comment } = req.body
  const { id } = req.params

  const task = await Task.findById(id)
  if (!task || !task.isActive) {
    return next(new AppError("Task not found", 404))
  }

  const isSelfAssigned = task.assignedBy.toString() === task.assignedTo.toString()
  const oldStatus = task.status

  // Validate transition using the centralized state machine config
  if (!isValidTransition(req.user.role, isSelfAssigned, oldStatus, status)) {
    return next(new AppError(`Forbidden status transition from '${oldStatus}' to '${status}' for role '${req.user.role}'`, 400))
  }

  const finalStatus = status

  // Update status and default progress
  task.status = finalStatus
  task.progressPercentage = getProgressForStatus(finalStatus)

  // Append transition to history audit trail
  task.history.push({
    fromStatus: oldStatus,
    toStatus: finalStatus,
    changedBy: req.user.id,
    comment: comment?.trim() || "Status changed."
  })

  // Handle active timer side-effects:
  if (finalStatus === "In Progress" && oldStatus !== "In Progress") {
    // 1. Stop any currently active timer for this employee first to prevent collision
    const activeSession = await WorkSession.findOne({
      employee: req.user.id,
      stoppedAt: null
    })
    if (activeSession) {
      const elapsed = (Date.now() - new Date(activeSession.startedAt).getTime()) / 1000
      activeSession.totalSeconds = Math.max(0, Math.floor(elapsed))
      activeSession.stoppedAt = new Date()
      await activeSession.save()
    }
    // 2. Start a new session for this task
    await WorkSession.create({
      task: task._id,
      employee: req.user.id,
      startedAt: new Date()
    })
  } else if (oldStatus === "In Progress" && finalStatus !== "In Progress") {
    // If moving OUT of In Progress, stop the session for this task
    const currentSession = await WorkSession.findOne({
      task: task._id,
      employee: req.user.id,
      stoppedAt: null
    })
    if (currentSession) {
      const elapsed = (Date.now() - new Date(currentSession.startedAt).getTime()) / 1000
      currentSession.totalSeconds = Math.max(0, Math.floor(elapsed))
      currentSession.stoppedAt = new Date()
      await currentSession.save()
    }
  }

  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime })
})

// ─── POST /api/tasks/:id/comments ────────────────────────────────────────────
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

  task.comments.push({ text: text.trim(), author: req.user.id })
  await task.save()

  const populatedTask = await Task.findById(id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .populate("comments.author", "name email role")
    .populate("history.changedBy", "name email role")

  const taskWithTime = await getTaskWithTime(populatedTask)
  res.json({ task: taskWithTime })
})

// ─── GET /api/tasks/daily — Ensure today's daily tasks exist for employee ────
export const ensureDailyTasks = asyncHandler(async (req, res) => {
  const employee = req.user
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  // Fetch applicable templates (global + department-matched)
  const user = await User.findById(employee.id)
  const templateFilter = {
    isActive: true,
    $or: [
      { scope: "global" },
      { scope: "department", departments: user.department },
      { scope: "employees", employees: employee.id }
    ]
  }
  const templates = await TaskTemplate.find(templateFilter)

  // For each template, check if today's task already exists
  for (const tpl of templates) {
    const exists = await Task.findOne({
      assignedTo: employee.id,
      templateRef: tpl._id,
      dailyDate: { $gte: startOfToday, $lt: endOfToday }
    })
    if (!exists) {
      await Task.create({
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        priority: tpl.priority,
        estimatedHours: tpl.estimatedHours,
        assignedBy: employee.id, // self-assigned daily
        assignedTo: employee.id,
        department: user.department || null,
        status: "Not Started",
        progressPercentage: 0,
        isDaily: true,
        templateRef: tpl._id,
        dailyDate: startOfToday
      })
    }
  }

  // Carry forward uncompleted daily tasks from previous days (pending carry-over)
  const incompletePastDailyTasks = await Task.find({
    assignedTo: employee.id,
    isDaily: true,
    isActive: true,
    dailyDate: { $lt: startOfToday },
    status: { $nin: ["Completed"] }
  })

  // Mark them with a carry-forward flag by updating dailyDate to today if not already updated today
  for (const t of incompletePastDailyTasks) {
    // Avoid duplicates: check if a carry-forward for this template already exists today
    if (t.templateRef) {
      const alreadyCarried = await Task.findOne({
        assignedTo: employee.id,
        templateRef: t.templateRef,
        dailyDate: { $gte: startOfToday, $lt: endOfToday }
      })
      if (!alreadyCarried) {
        // Re-stamp to today so it surfaces in today's view
        t.dailyDate = startOfToday
        t.isCarryForward = true
        await t.save()
      }
    }
  }

  res.json({ success: true, message: "Daily tasks provisioned" })
})

// ─── GET /api/tasks/report — Admin progress report ───────────────────────────
export const getProgressReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query

  // ── 1. Build Task Query with Date Filters ──────────────────────────────────
  const query = { isActive: true }
  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    // If only YYYY-MM-DD is passed, make sure end covers the entire day
    if (endDate.length <= 10) {
      end.setHours(23, 59, 59, 999)
    }
    query.$or = [
      { createdAt: { $gte: start, $lte: end } },
      { dailyDate: { $gte: start, $lte: end } }
    ]
  }

  const tasks = await Task.find(query)
    .populate("assignedTo", "name email department team")
    .populate("assignedBy", "name email")
    .populate("department", "name")
    .lean()

  const taskIds = tasks.map(t => t._id)

  // ── 2. Batch-aggregate tracked seconds for all tasks ──────────────────────
  const matchSession = { task: { $in: taskIds }, stoppedAt: { $ne: null } }
  const activeSessionFilter = { task: { $in: taskIds }, stoppedAt: null }

  if (startDate && endDate) {
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (endDate.length <= 10) {
      end.setHours(23, 59, 59, 999)
    }
    matchSession.startedAt = { $gte: start, $lte: end }
    activeSessionFilter.startedAt = { $gte: start, $lte: end }
  }

  const sessionAgg = await WorkSession.aggregate([
    { $match: matchSession },
    { $group: { _id: "$task", totalStopped: { $sum: "$totalSeconds" } } }
  ])
  const activeSessions = await WorkSession.find(activeSessionFilter)

  const stoppedMap = {}
  sessionAgg.forEach(s => { stoppedMap[s._id.toString()] = s.totalStopped })
  const activeMap = {}
  activeSessions.forEach(s => { activeMap[s.task.toString()] = calculateSessionSeconds(s) })

  const trackedMap = {}
  taskIds.forEach(id => {
    const sid = id.toString()
    trackedMap[sid] = (stoppedMap[sid] || 0) + (activeMap[sid] || 0)
  })

  // ── 2b. Overdue is an absolute, always-current signal — computed from the full
  //      active task set regardless of the report's date filter, so switching the
  //      timeframe dropdown never changes what counts as overdue.
  const overdueTasks = await Task.find({
    isActive: true,
    dueDate: { $lt: new Date() },
    status: { $ne: "Completed" }
  })
    .select("assignedTo department priority")
    .populate({ path: "assignedTo", select: "team" })
    .lean()

  const overdueByEmployee = {}
  const overdueByDept = {}
  const overdueByTeam = {}
  const overdueByPriority = {}
  overdueTasks.forEach(t => {
    const empId = t.assignedTo?._id?.toString()
    if (empId) overdueByEmployee[empId] = (overdueByEmployee[empId] || 0) + 1

    const deptId = t.department?.toString() || "unassigned"
    overdueByDept[deptId] = (overdueByDept[deptId] || 0) + 1

    const teamId = t.assignedTo?.team?.toString() || "unassigned"
    overdueByTeam[teamId] = (overdueByTeam[teamId] || 0) + 1

    if (t.priority) overdueByPriority[t.priority] = (overdueByPriority[t.priority] || 0) + 1
  })

  // ── 3. Fetch active employees — a manager sees only their direct reports;
  //      an employee sees only themselves; super_admin sees the whole org
  //      (Locked Logic §12) ─────────────────────────────────────────────────
  const userFilter = { isActive: true, role: "employee" }
  if (req.user.role === "manager") {
    userFilter.manager = req.user.id
  } else if (req.user.role === "employee") {
    userFilter._id = req.user.id
  }
  const users = await User.find(userFilter)
    .populate("department", "name")
    .populate("team", "name")
    .lean()

  // ── 4. Employee-wise report ───────────────────────────────────────────────
  const employeeReport = users.map(u => {
    const uTasks = tasks.filter(t => t.assignedTo && t.assignedTo._id.toString() === u._id.toString())
    const total = uTasks.length
    const completed = uTasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = uTasks.filter(t => t.status === "In Progress").length
    const pending = uTasks.filter(t => t.status === "Pending").length
    const overdue = overdueByEmployee[u._id.toString()] || 0
    const totalTrackedSeconds = uTasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const avgProgress = total > 0 ? Math.round(uTasks.reduce((acc, t) => acc + t.progressPercentage, 0) / total) : 0
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Detailed employee tasks list for drilldown
    const employeeTasks = uTasks.map(t => ({
      _id: t._id,
      title: t.title,
      description: t.description || "",
      category: t.category || "General",
      priority: t.priority,
      status: t.status,
      progressPercentage: t.progressPercentage,
      estimatedHours: t.estimatedHours || 0,
      totalTrackedSeconds: trackedMap[t._id.toString()] || 0,
      dueDate: t.dueDate,
      createdAt: t.createdAt
    }))

    // Calculate Avg. Resolution Velocity in Days
    const completedTasks = uTasks.filter(t => ["Completed"].includes(t.status))
    let totalResolutionTimeMs = 0
    completedTasks.forEach(t => {
      const completionHistory = t.history?.find(h => ["Completed"].includes(h.toStatus))
      const completionTime = completionHistory ? new Date(completionHistory.timestamp) : new Date(t.updatedAt)
      const duration = completionTime.getTime() - new Date(t.createdAt).getTime()
      totalResolutionTimeMs += Math.max(0, duration)
    })
    const avgResolutionDays = completedTasks.length > 0
      ? parseFloat(((totalResolutionTimeMs / (1000 * 60 * 60 * 24)) / completedTasks.length).toFixed(1))
      : 0

    // Calculate Estimation Accuracy (Tracked vs Estimated)
    const completedWithEstimation = completedTasks.filter(t => t.estimatedHours > 0)
    let totalEstimatedHours = 0
    let totalTrackedHoursForEst = 0
    completedWithEstimation.forEach(t => {
      totalEstimatedHours += t.estimatedHours
      totalTrackedHoursForEst += (trackedMap[t._id.toString()] || 0) / 3600
    })
    const estimationAccuracy = totalEstimatedHours > 0
      ? Math.round((totalEstimatedHours / Math.max(0.1, totalTrackedHoursForEst)) * 100)
      : 100 // default to 100 if no estimates configured

    // Daily vs Assigned completion, tracked separately (Locked Logic §7) — Overall
    // completionRate above is the derived summary, not the primary metric.
    const dailyTasks = uTasks.filter(t => t.isDaily)
    const dailyNewCount = dailyTasks.filter(t => !t.isCarryForward).length
    const dailyCarriedForwardCount = dailyTasks.filter(t => t.isCarryForward).length
    const dailyCompletedCount = dailyTasks.filter(t => t.status === "Completed").length
    const dailyCompletionRate = dailyTasks.length > 0 ? Math.round((dailyCompletedCount / dailyTasks.length) * 100) : 0

    const assignedTasks = uTasks.filter(t => !t.isDaily)
    const assignedCompletedCount = assignedTasks.filter(t => t.status === "Completed").length
    const assignedCompletionRate = assignedTasks.length > 0 ? Math.round((assignedCompletedCount / assignedTasks.length) * 100) : 0

    // Planned vs Actual Capacity Utilization + a distinct Capacity Overrun signal —
    // today only, matching V1 single-day capacity planning (Locked Logic §6/§7).
    const today = new Date()
    const todaysTasks = uTasks.filter(t => {
      const relevantDate = t.isDaily ? t.dailyDate : t.dueDate
      return relevantDate && isSameCalendarDay(new Date(relevantDate), today)
    })
    const capacityHours = Math.max(0, (u.dailyWorkingHours ?? 8) - (u.breakHours ?? 1))
    const plannedHoursToday = todaysTasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0)
    const actualHoursToday = todaysTasks.reduce((sum, t) => sum + (trackedMap[t._id.toString()] || 0), 0) / 3600
    const plannedUtilizationPct = capacityHours > 0 ? Math.round((plannedHoursToday / capacityHours) * 100) : 0
    const actualUtilizationPct = capacityHours > 0 ? Math.round((actualHoursToday / capacityHours) * 100) : 0
    const isCapacityOverrunToday = actualHoursToday > capacityHours

    // Estimation pattern (Locked Logic §10) — always retains the underlying task-level
    // data (recentEstimatedTasks) so a manager can drill into exactly which tasks caused it.
    const recentEstimatedTasks = [...completedWithEstimation]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, PATTERN_LOOKBACK)
      .map(t => {
        const trackedSeconds = trackedMap[t._id.toString()] || 0
        const estimatedSeconds = t.estimatedHours * 3600
        return {
          _id: t._id,
          title: t.title,
          estimatedHours: t.estimatedHours,
          trackedHours: parseFloat((trackedSeconds / 3600).toFixed(1)),
          overrunPercentage: estimatedSeconds > 0 ? Math.round(((trackedSeconds - estimatedSeconds) / estimatedSeconds) * 100) : 0,
          isOverrun: trackedSeconds > estimatedSeconds
        }
      })
    const recentOverrunCount = recentEstimatedTasks.filter(t => t.isOverrun).length
    const recentOverrunProportion = recentEstimatedTasks.length > 0
      ? parseFloat((recentOverrunCount / recentEstimatedTasks.length).toFixed(2))
      : 0
    const hasOverrunPattern = recentEstimatedTasks.length >= PATTERN_MIN_SAMPLE && recentOverrunProportion > PATTERN_THRESHOLD

    // Pending backlog age (Locked Logic §8)
    const pendingAges = uTasks.map(getPendingAgeDays).filter(a => a !== null)
    const pendingBacklogAvgAgeDays = pendingAges.length > 0
      ? parseFloat((pendingAges.reduce((a, b) => a + b, 0) / pendingAges.length).toFixed(1))
      : 0
    const pendingBacklogOldestAgeDays = pendingAges.length > 0
      ? parseFloat(Math.max(...pendingAges).toFixed(1))
      : 0

    return {
      _id: u._id,
      name: u.name,
      email: u.email,
      department: u.department?.name || "—",
      team: u.team?.name || "—",
      total,
      completed,
      inProgress,
      pending,
      overdue,
      totalTrackedSeconds,
      avgProgress,
      completionRate,
      tasks: employeeTasks,
      avgResolutionDays,
      estimationAccuracy,
      // Productivity signals (Locked Logic §7/§8/§11) — kept separate, never combined
      // into a single score.
      dailyCompletionRate,
      dailyNewCount,
      dailyCarriedForwardCount,
      assignedCompletionRate,
      assignedTotal: assignedTasks.length,
      overallCompletionRate: completionRate,
      capacityHoursToday: capacityHours,
      plannedUtilizationPct,
      actualUtilizationPct,
      isCapacityOverrunToday,
      pendingBacklogAvgAgeDays,
      pendingBacklogOldestAgeDays,
      hasOverrunPattern,
      recentOverrunProportion,
      recentEstimatedTasks
    }
  })

  // ── 5. Department-wise report ─────────────────────────────────────────────
  const deptMap = {}
  tasks.forEach(t => {
    const deptId = t.department?._id?.toString() || "unassigned"
    const deptName = t.department?.name || "Unassigned"
    if (!deptMap[deptId]) deptMap[deptId] = { deptId, deptName, tasks: [] }
    deptMap[deptId].tasks.push(t)
  })

  const departmentReport = Object.values(deptMap).map(d => {
    const total = d.tasks.length
    const completed = d.tasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = d.tasks.filter(t => t.status === "In Progress").length
    const overdue = overdueByDept[d.deptId] || 0
    const totalTrackedSeconds = d.tasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const memberSet = new Set(d.tasks.map(t => t.assignedTo?._id?.toString()).filter(Boolean))
    return { deptId: d.deptId, name: d.deptName, total, completed, inProgress, overdue, totalTrackedSeconds, completionRate, memberCount: memberSet.size }
  })

  // ── 6. Team-wise report ───────────────────────────────────────────────────
  const teamUserMap = {}
  users.forEach(u => {
    const teamId = u.team?._id?.toString() || "unassigned"
    const teamName = u.team?.name || "No Team"
    if (!teamUserMap[teamId]) teamUserMap[teamId] = { teamId, teamName, memberIds: [] }
    teamUserMap[teamId].memberIds.push(u._id.toString())
  })

  const teamReport = Object.values(teamUserMap).map(team => {
    const tTasks = tasks.filter(t => t.assignedTo && team.memberIds.includes(t.assignedTo._id.toString()))
    const total = tTasks.length
    const completed = tTasks.filter(t => ["Completed"].includes(t.status)).length
    const inProgress = tTasks.filter(t => t.status === "In Progress").length
    const overdue = overdueByTeam[team.teamId] || 0
    const totalTrackedSeconds = tTasks.reduce((acc, t) => acc + (trackedMap[t._id.toString()] || 0), 0)
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    return { teamId: team.teamId, name: team.teamName, total, completed, inProgress, overdue, totalTrackedSeconds, completionRate, memberCount: team.memberIds.length }
  })

  // ── 7. Task health report ─────────────────────────────────────────────────
  const allTasks = tasks
  const healthReport = {
    totalTasks: allTasks.length,
    completedTasks: allTasks.filter(t => ["Completed"].includes(t.status)).length,
    inProgressTasks: allTasks.filter(t => t.status === "In Progress").length,
    notStartedTasks: allTasks.filter(t => t.status === "Not Started").length,
    overdueTasks: overdueTasks.length,
    pendingTasks: allTasks.filter(t => t.status === "Pending").length,
    inReviewTasks: allTasks.filter(t => t.status === "In Review").length,
    totalTrackedSeconds: Object.values(trackedMap).reduce((a, b) => a + b, 0),
    avgCompletionRate: allTasks.length > 0
      ? Math.round(allTasks.filter(t => ["Completed"].includes(t.status)).length / allTasks.length * 100)
      : 0
  }

  // ── 8. Priority breakdown ─────────────────────────────────────────────────
  const priorityReport = ["high", "medium", "low"].map(p => {
    const pTasks = allTasks.filter(t => t.priority === p)
    return {
      priority: p,
      total: pTasks.length,
      completed: pTasks.filter(t => ["Completed"].includes(t.status)).length,
      overdue: overdueByPriority[p] || 0
    }
  })

  // An employee caller only ever sees their own row — department/team/org-wide
  // breakdowns stay manager/super_admin only, per "avoid showing employees
  // unnecessary organizational-level analytics."
  if (req.user.role === "employee") {
    return res.json({ employeeReport })
  }

  res.json({
    employeeReport,
    departmentReport,
    teamReport,
    healthReport,
    priorityReport
  })
})
