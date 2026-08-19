import OrgSettings from "../models/OrgSettings.js"
import Absence from "../models/Absence.js"

// THE single source of truth for "is this a working day" and "how much capacity does
// this person have on this date".
//
// Before this existed the capacity formula lived in two places — taskHelpers.js on the
// frontend and inline in taskController.getProgressReport — which meant a change to one
// silently disagreed with the other. Everything server-side now derives from here, and
// the frontend applies the identical rule shape via GET /api/calendar/context.
//
// Locked Logic §6: daily capacity = working hours − breaks. This module only decides
// whether that base figure applies in full, in half, or not at all on a given date.

// ─── Date helpers ─────────────────────────────────────────────────────────────
// All comparisons are done on local start-of-day, matching how the rest of the app
// (isSameCalendarDay in taskController, dailyDate stamping) already treats dates.
export const startOfDay = (date) => {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export const isSameCalendarDay = (a, b) => {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
}

// ─── Settings access (cached) ─────────────────────────────────────────────────
// The calendar changes a few times a year but is read on every report and every
// provisioning run, so it's held in memory with a short TTL and invalidated on write.
let cachedSettings = null
let cachedAt = 0
const SETTINGS_TTL_MS = 60 * 1000

export const getOrgSettings = async ({ force = false } = {}) => {
  const fresh = cachedSettings && (Date.now() - cachedAt) < SETTINGS_TTL_MS
  if (fresh && !force) return cachedSettings

  const settings = await OrgSettings.getSingleton()
  cachedSettings = settings
  cachedAt = Date.now()
  return settings
}

export const invalidateSettingsCache = () => {
  cachedSettings = null
  cachedAt = 0
}

// ─── Working days ─────────────────────────────────────────────────────────────
export const isHoliday = (date, settings) =>
  (settings?.holidays || []).some(h => isSameCalendarDay(h.date, date))

export const getHoliday = (date, settings) =>
  (settings?.holidays || []).find(h => isSameCalendarDay(h.date, date)) || null

export const isWorkingDay = (date, settings) => {
  const workingDays = settings?.workingDays || [1, 2, 3, 4, 5]
  if (!workingDays.includes(new Date(date).getDay())) return false
  return !isHoliday(date, settings)
}

// Next working day strictly after `from`. Used when rescheduling — moving a task onto
// a Saturday is not a real reschedule. Bounded so a misconfigured calendar with no
// working days can't spin forever.
export const getNextWorkingDay = (from, settings) => {
  const cursor = startOfDay(from)
  for (let i = 0; i < 14; i++) {
    cursor.setDate(cursor.getDate() + 1)
    if (isWorkingDay(cursor, settings)) return new Date(cursor)
  }
  // No working day found within two weeks — fall back to the next calendar day rather
  // than returning nothing.
  const fallback = startOfDay(from)
  fallback.setDate(fallback.getDate() + 1)
  return fallback
}

// Count of working days in [from, to]. Used for age metrics so a task sitting over a
// weekend doesn't accrue "age" nobody could have acted on.
export const workingDaysBetween = (from, to, settings) => {
  const start = startOfDay(from)
  const end = startOfDay(to)
  if (end < start) return 0

  let count = 0
  const cursor = new Date(start)
  // Hard bound: a stale/corrupt timestamp shouldn't produce an unbounded loop.
  let guard = 0
  while (cursor <= end && guard < 3650) {
    if (isWorkingDay(cursor, settings)) count++
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }
  return count
}

// ─── Absences ─────────────────────────────────────────────────────────────────
export const getAbsencesInRange = async (from, to, employeeIds = null) => {
  const filter = {
    isActive: true,
    startDate: { $lte: startOfDay(to) },
    endDate: { $gte: startOfDay(from) }
  }
  if (employeeIds) filter.employee = { $in: employeeIds }
  return Absence.find(filter).lean()
}

// The absence covering `date` for this employee, or null. Takes a pre-fetched list so
// report loops don't issue a query per employee per day (N+1).
export const getAbsenceForDay = (employeeId, date, absences = []) => {
  const day = startOfDay(date)
  const id = String(employeeId)
  return absences.find(a =>
    String(a.employee) === id &&
    startOfDay(a.startDate) <= day &&
    startOfDay(a.endDate) >= day
  ) || null
}

// ─── Capacity ─────────────────────────────────────────────────────────────────
// Base capacity before the calendar is applied (Locked Logic §6).
export const getBaseCapacityHours = (employee) =>
  Math.max(0, (employee?.dailyWorkingHours ?? 8) - (employee?.breakHours ?? 1))

/**
 * Capacity for one employee on one date, with the reason when it isn't the full figure.
 *
 * Returns { hours, reason, isWorkingDay, absence }
 *   reason: null | "weekend" | "holiday" | "leave" | "half_day" | "no_hours_configured"
 *
 * Callers should treat `hours === 0` as "utilisation is not meaningful today" and render
 * "—" rather than 0% — a person is not 0% utilised on a Sunday, the question doesn't apply.
 */
export const getCapacityForDay = (employee, date, settings, absences = []) => {
  const base = getBaseCapacityHours(employee)

  if (!isWorkingDay(date, settings)) {
    const holiday = getHoliday(date, settings)
    return {
      hours: 0,
      reason: holiday ? "holiday" : "weekend",
      holidayName: holiday?.name || null,
      isWorkingDay: false,
      absence: null
    }
  }

  const absence = getAbsenceForDay(employee._id || employee.id, date, absences)
  if (absence) {
    if (absence.type === "half_day") {
      return { hours: base / 2, reason: "half_day", isWorkingDay: true, absence }
    }
    return { hours: 0, reason: absence.type === "sick" ? "leave" : absence.type, isWorkingDay: true, absence }
  }

  if (base === 0) {
    return { hours: 0, reason: "no_hours_configured", isWorkingDay: true, absence: null }
  }

  return { hours: base, reason: null, isWorkingDay: true, absence: null }
}

// Convenience for callers that only need today and haven't pre-fetched anything.
export const getCapacityToday = async (employee) => {
  const settings = await getOrgSettings()
  const absences = await getAbsencesInRange(new Date(), new Date(), [employee._id || employee.id])
  return getCapacityForDay(employee, new Date(), settings, absences)
}
