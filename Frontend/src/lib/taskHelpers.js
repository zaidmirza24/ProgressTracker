// Is this task assigned by its own assignee? The distinction the whole workflow turns
// on: self-assigned work (including every Daily Task) skips review and can be completed
// directly, while manager-assigned work must route through In Review.
//
// Accepts both populated refs ({ _id }) and raw id strings. The previous form —
// `task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo`
// — read as though it handled both, but on an unpopulated task both sides of the first
// comparison were `undefined`, so it short-circuited to TRUE and the string fallback
// never ran. Any manager-assigned task arriving without populated refs would have been
// treated as self-assigned: the employee would be offered a "Completed" transition the
// server then rejects, and the stepper would hide the review step.
//
// A task with no assignment data at all is deliberately NOT self-created — that path
// shows the review-gated flow, which is the safe default.
export const isSelfCreated = (task) => {
  const assignedBy = task?.assignedBy?._id ?? task?.assignedBy
  const assignedTo = task?.assignedTo?._id ?? task?.assignedTo
  return Boolean(assignedBy) && String(assignedBy) === String(assignedTo)
}

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

// ─── Work calendar ────────────────────────────────────────────────────────────
// These mirror Backend/services/calendarService.js exactly. The frontend keeps its own
// copy of the RULE (not the data) so an optimistic task edit can recalculate capacity
// in the same frame; the DATA — working days, holidays, absences — always comes from
// GET /api/calendar/context so the two can't disagree.
//
// `calendar` is { workingDays, holidays, absences }. When it's absent (not yet loaded)
// every day is treated as a working day, which is the pre-calendar behaviour.
export const isHolidayOn = (day, calendar) =>
  (calendar?.holidays || []).some(h => isSameCalendarDay(new Date(h.date), day))

export const getHolidayOn = (day, calendar) =>
  (calendar?.holidays || []).find(h => isSameCalendarDay(new Date(h.date), day)) || null

export const isWorkingDay = (day, calendar) => {
  if (!calendar?.workingDays) return true
  if (!calendar.workingDays.includes(new Date(day).getDay())) return false
  return !isHolidayOn(day, calendar)
}

const atStartOfDay = (d) => {
  const x = new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), x.getDate())
}

export const getAbsenceOn = (employeeId, day, calendar) => {
  const target = atStartOfDay(day)
  const id = String(employeeId)
  return (calendar?.absences || []).find(a =>
    String(a.employee?._id || a.employee) === id &&
    atStartOfDay(a.startDate) <= target &&
    atStartOfDay(a.endDate) >= target
  ) || null
}

// Next working day strictly after `from` — used by "move to tomorrow" so a task is
// never rescheduled onto a weekend or holiday.
export const getNextWorkingDay = (from = new Date(), calendar = null) => {
  const cursor = atStartOfDay(from)
  for (let i = 0; i < 14; i++) {
    cursor.setDate(cursor.getDate() + 1)
    if (isWorkingDay(cursor, calendar)) return new Date(cursor)
  }
  const fallback = atStartOfDay(from)
  fallback.setDate(fallback.getDate() + 1)
  return fallback
}

/**
 * Capacity for one employee on one day.
 *
 * `extraHours` previews a not-yet-created assignment; `day` defaults to today;
 * `calendar` applies weekends/holidays/absence (omit it and every day counts as a
 * full working day).
 *
 * `capacityHours` is 0 on a non-working day or full absence, and halved on a half day.
 * Callers must treat 0 capacity as "utilisation doesn't apply" rather than 0% (§41) —
 * `capacityReason` says why so the UI can label it.
 */
export const getEmployeeCapacity = (employee, tasks, extraHours = 0, day = new Date(), calendar = null) => {
  const baseCapacity = Math.max(0, (employee.dailyWorkingHours ?? 8) - (employee.breakHours ?? 1))
  const plannedHours = getPlannedHoursForDay(tasks, employee._id, day) + extraHours

  const working = isWorkingDay(day, calendar)
  const absence = working ? getAbsenceOn(employee._id, day, calendar) : null

  let capacityHours = baseCapacity
  let capacityReason = null
  if (!working) {
    capacityHours = 0
    capacityReason = isHolidayOn(day, calendar) ? "holiday" : "weekend"
  } else if (absence) {
    if (absence.type === "half_day") {
      capacityHours = baseCapacity / 2
      capacityReason = "half_day"
    } else {
      capacityHours = 0
      capacityReason = absence.type === "sick" ? "leave" : absence.type
    }
  } else if (baseCapacity === 0) {
    // Nobody set this person's working hours. Both sides already agreed on 0 hours, but
    // only the server said WHY — so the workload bar showed an unexplained 0h where the
    // admin report explained it. CAPACITY_REASON_LABELS has had this label all along;
    // nothing ever produced it. Mirrors calendarService.getCapacityForDay.
    capacityReason = "no_hours_configured"
  }

  return {
    capacityHours,
    plannedHours,
    remainingHours: capacityHours - plannedHours,
    // Work planned on a zero-capacity day counts as over capacity — that's precisely
    // the case a manager needs to see (a task due on someone's leave day).
    isOverCapacity: plannedHours > capacityHours,
    isWorkingDay: working,
    capacityReason,
    absence,
    holidayName: getHolidayOn(day, calendar)?.name || null
  }
}

// Human-readable label for why capacity is reduced, for badges and tooltips.
export const CAPACITY_REASON_LABELS = {
  weekend: "Non-working day",
  holiday: "Holiday",
  leave: "On leave",
  sick: "On leave",
  half_day: "Half day",
  no_hours_configured: "No working hours set"
}

// V2 preview: capacity for each of the next `days` days starting at `startDate`, still
// built entirely from single-day capacity math (Locked Logic §6) — just repeated across
// a window so a manager can spot a future overload before assigning into it.
export const getCapacityForecast = (employee, tasks, days = 7, startDate = new Date(), calendar = null) => {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    return { date, ...getEmployeeCapacity(employee, tasks, 0, date, calendar) }
  })
}

export const isTaskOverdue = (task) =>
  Boolean(task.dueDate) && new Date(task.dueDate) < new Date() && task.status !== "Completed"

const toDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// Next WORKING day as YYYY-MM-DD, for the "move to tomorrow" quick action — a task
// rescheduled onto a Saturday hasn't really been rescheduled. Without a calendar it
// falls back to the next calendar day.
export const getTomorrowDateString = (from = new Date(), calendar = null) =>
  toDateString(getNextWorkingDay(from, calendar))

// Human-readable label for a date string, used in confirmation toasts.
export const formatDayLabel = (dateStr) =>
  new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

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
