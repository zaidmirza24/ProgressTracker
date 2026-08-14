export const isSelfCreated = (task) =>
  task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo

const isSameCalendarDay = (dateA, dateB) =>
  dateA.getFullYear() === dateB.getFullYear() &&
  dateA.getMonth() === dateB.getMonth() &&
  dateA.getDate() === dateB.getDate()

// V1 single-day capacity planning (Locked Logic §6): Daily + Assigned tasks landing on
// `day` count toward planned hours, driven by remaining estimate — not actual time logged.
export const getPlannedHoursForDay = (tasks, employeeId, day = new Date()) =>
  tasks
    .filter(t => {
      const assignee = t.assignedTo?._id || t.assignedTo
      if (assignee !== employeeId || t.status === "Completed") return false
      const relevantDate = t.isDaily ? t.dailyDate : t.dueDate
      if (!relevantDate) return false
      return isSameCalendarDay(new Date(relevantDate), day)
    })
    .reduce((sum, t) => sum + (t.estimatedHours || 0), 0)

// `extraHours` lets callers preview the effect of a not-yet-created assignment;
// `day` defaults to today but callers (e.g. a multi-day forecast) can pass any date.
export const getEmployeeCapacity = (employee, tasks, extraHours = 0, day = new Date()) => {
  const capacityHours = Math.max(0, (employee.dailyWorkingHours ?? 8) - (employee.breakHours ?? 1))
  const plannedHours = getPlannedHoursForDay(tasks, employee._id, day) + extraHours
  const remainingHours = capacityHours - plannedHours
  return { capacityHours, plannedHours, remainingHours, isOverCapacity: plannedHours > capacityHours }
}

// V2 preview: capacity for each of the next `days` days starting at `startDate`, still
// built entirely from single-day capacity math (Locked Logic §6) — just repeated across
// a window so a manager can spot a future overload before assigning into it.
export const getCapacityForecast = (employee, tasks, days = 7, startDate = new Date()) => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return { date, ...getEmployeeCapacity(employee, tasks, 0, date) }
  })
}

export const isTaskOverdue = (task) =>
  Boolean(task.dueDate) && new Date(task.dueDate) < new Date() && task.status !== "Completed"

// Manager's inline dropdown transitions
export const getNextStatusesForManager = (task) => {
  switch (task.status) {
    case "In Review": return ["Completed", "In Progress"] // Approve, or return for rework
    case "Not Started": return ["In Progress"]
    case "In Progress": return ["Pending", "In Review", "Completed"]
    case "Pending": return ["In Progress"]
    case "Completed": return ["In Progress"] // Manager/admin reopen for correction
    default: return []
  }
}

// Employee's transitions — vary by self-assigned vs manager-assigned
export const getNextStatuses = (task) => {
  if (isSelfCreated(task)) {
    switch (task.status) {
      case "Not Started": return ["In Progress"]
      case "In Progress": return ["Pending", "Completed"]
      case "Pending": return ["In Progress"]
      default: return [] // Completed is locked — no employee-side reopen
    }
  } else {
    switch (task.status) {
      case "Not Started": return ["In Progress"]
      case "In Progress": return ["Pending", "In Review"]
      case "Pending": return ["In Progress"]
      default: return [] // In Review / Completed are locked pending manager action
    }
  }
}
