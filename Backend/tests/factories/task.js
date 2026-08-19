import Task from "../../models/Task.js"
import { getProgressForStatus } from "../../services/taskMetrics.js"
import { startOfLocalDay } from "../helpers/clock.js"

let sequence = 0

const idOf = (userOrId) => userOrId?._id ?? userOrId

/**
 * Create a persisted task.
 *
 * `assignedTo` is the only required field; `assignedBy` defaults to the same person,
 * which makes the task SELF-ASSIGNED — the distinction the workflow rules turn on
 * (self-assigned work skips review, manager-assigned work routes through In Review).
 * Use makeAssignedTask/makeDailyTask below to state that intent explicitly.
 */
export const makeTask = async (overrides = {}) => {
  const assignedTo = idOf(overrides.assignedTo)
  if (!assignedTo) throw new Error("makeTask requires assignedTo")

  sequence++
  const status = overrides.status ?? "Not Started"

  return Task.create({
    title: overrides.title ?? `Test task ${sequence}`,
    description: overrides.description ?? "",
    category: overrides.category ?? "General",
    department: overrides.department ? idOf(overrides.department) : null,
    assignedBy: idOf(overrides.assignedBy) ?? assignedTo,
    assignedTo,
    priority: overrides.priority ?? "medium",
    estimatedHours: overrides.estimatedHours ?? 0,
    dueDate: overrides.dueDate ?? null,
    status,
    // Derived from status unless stated explicitly, so a fixture matches what the app
    // itself would have written. Setting a status without its progress produced tasks
    // that could never exist in production and made avgProgress meaningless.
    progressPercentage: overrides.progressPercentage ?? getProgressForStatus(status),
    comments: overrides.comments ?? [],
    isActive: overrides.isActive ?? true,
    isBlocked: overrides.isBlocked ?? false,
    blockedReason: overrides.blockedReason ?? "",
    blockedAt: overrides.blockedAt ?? null,
    blockedBy: overrides.blockedBy ? idOf(overrides.blockedBy) : null,
    isDaily: overrides.isDaily ?? false,
    isCarryForward: overrides.isCarryForward ?? false,
    templateRef: overrides.templateRef ? idOf(overrides.templateRef) : null,
    dailyDate: overrides.dailyDate ?? null,
    originalDailyDate: overrides.originalDailyDate ?? null,
    history: overrides.history ?? []
  })
}

/** Manager-assigned work: routes through In Review, employee cannot self-complete. */
export const makeAssignedTask = (overrides = {}) => {
  if (!overrides.assignedBy) throw new Error("makeAssignedTask requires assignedBy (the manager)")
  return makeTask(overrides)
}

/** A daily task as the provisioning service would create it: self-assigned, dated today. */
export const makeDailyTask = (overrides = {}) => {
  const day = overrides.dailyDate ?? startOfLocalDay()
  return makeTask({
    category: "Daily",
    estimatedHours: 1,
    ...overrides,
    isDaily: true,
    dailyDate: day,
    originalDailyDate: overrides.originalDailyDate ?? day
  })
}

/**
 * A status-transition history entry, for tasks that need a past to be measured
 * against — rework counting, first-pass approval, and resolution velocity all read
 * task.history rather than any stored field.
 */
export const historyEntry = ({ from, to, changedBy, comment = "", timestamp = new Date() }) => ({
  fromStatus: from,
  toStatus: to,
  changedBy: idOf(changedBy),
  comment,
  timestamp
})

/** The exact history shape a manager sending work back produces. */
export const reworkHistory = (manager, comment = "Needs another pass", timestamp = new Date()) => [
  historyEntry({ from: "In Progress", to: "In Review", changedBy: manager, timestamp }),
  historyEntry({ from: "In Review", to: "In Progress", changedBy: manager, comment, timestamp })
]
