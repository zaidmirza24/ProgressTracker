import mongoose from "mongoose"
import OrgSettings from "../models/OrgSettings.js"
import Absence from "../models/Absence.js"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"
import AppError from "../utils/appError.js"
import {
  getOrgSettings,
  invalidateSettingsCache,
  getAbsencesInRange,
  startOfDay
} from "../services/calendarService.js"

// How far ahead the client-side capacity forecast looks (TeamCapacityForecast renders
// 7 days); fetch a little beyond that so the grid never renders a gap.
const CONTEXT_WINDOW_DAYS = 31

// Absences a caller is allowed to see — mirrors the visibility rule used by
// getTasks/getProgressReport: employee → own only, manager → own direct reports,
// super_admin → everyone.
const getVisibleEmployeeIds = async (req) => {
  if (req.user.role === "super_admin") return null // null = unrestricted
  if (req.user.role === "employee") return [req.user.id]

  const subordinates = await User.find({ manager: req.user.id, isActive: true }).select("_id")
  return [...subordinates.map(s => s._id.toString()), req.user.id]
}

// Managers may only manage absences for their own direct reports; super_admin for anyone.
const canManageAbsenceFor = async (req, employeeId) => {
  if (req.user.role === "super_admin") return true
  if (req.user.role !== "manager") return false
  const isSubordinate = await User.exists({ _id: employeeId, manager: req.user.id })
  return !!isSubordinate
}

// ─── GET /api/calendar/context ────────────────────────────────────────────────
// One call giving the frontend everything it needs to compute capacity locally with
// the same rules the server uses: working days, holidays, and in-scope absences.
export const getCalendarContext = asyncHandler(async (req, res) => {
  const settings = await getOrgSettings()

  const from = startOfDay(new Date())
  const to = startOfDay(new Date())
  to.setDate(to.getDate() + CONTEXT_WINDOW_DAYS)
  // Include absences already in progress, not just ones starting inside the window.
  const windowStart = new Date(from)
  windowStart.setDate(windowStart.getDate() - CONTEXT_WINDOW_DAYS)

  const employeeIds = await getVisibleEmployeeIds(req)
  const absences = await getAbsencesInRange(windowStart, to, employeeIds)

  res.json({
    workingDays: settings.workingDays,
    holidays: settings.holidays,
    timezone: settings.timezone,
    absences
  })
})

// ─── GET /api/calendar/settings ───────────────────────────────────────────────
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrgSettings()
  res.json({ settings })
})

// ─── PUT /api/calendar/settings ───────────────────────────────────────────────
export const updateSettings = asyncHandler(async (req, res, next) => {
  const { workingDays, holidays, timezone } = req.body

  const settings = await OrgSettings.getSingleton()

  if (workingDays !== undefined) {
    if (!Array.isArray(workingDays) || workingDays.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
      return next(new AppError("workingDays must be an array of integers from 0 (Sunday) to 6 (Saturday)", 400, "INVALID_WORKING_DAYS"))
    }
    if (workingDays.length === 0) {
      return next(new AppError("At least one working day is required", 400, "INVALID_WORKING_DAYS"))
    }
    settings.workingDays = [...new Set(workingDays)].sort()
  }

  if (holidays !== undefined) {
    if (!Array.isArray(holidays)) {
      return next(new AppError("holidays must be an array", 400, "INVALID_HOLIDAYS"))
    }
    const normalised = []
    for (const h of holidays) {
      const date = new Date(h.date)
      if (Number.isNaN(date.getTime())) {
        return next(new AppError(`"${h.date}" is not a valid holiday date`, 400, "INVALID_HOLIDAYS"))
      }
      if (!h.name || !String(h.name).trim()) {
        return next(new AppError("Every holiday needs a name", 400, "INVALID_HOLIDAYS"))
      }
      // Normalise to start-of-day so comparisons are exact regardless of what time
      // component the client happened to send (§25).
      normalised.push({ date: startOfDay(date), name: String(h.name).trim() })
    }
    // Collapse duplicates on the same date — last one wins.
    const byDate = new Map()
    for (const h of normalised) byDate.set(h.date.getTime(), h)
    settings.holidays = [...byDate.values()].sort((a, b) => a.date - b.date)
  }

  if (timezone !== undefined) {
    settings.timezone = String(timezone).trim() || "Asia/Kolkata"
  }

  await settings.save()
  invalidateSettingsCache()

  res.json({ settings })
})

// ─── GET /api/calendar/absences ───────────────────────────────────────────────
export const getAbsences = asyncHandler(async (req, res) => {
  const employeeIds = await getVisibleEmployeeIds(req)

  const filter = { isActive: true }
  if (employeeIds) filter.employee = { $in: employeeIds }
  if (req.query.employee) {
    // Requesting a specific person must still respect scope.
    if (employeeIds && !employeeIds.some(id => id.toString() === req.query.employee)) {
      return res.json({ absences: [] })
    }
    filter.employee = req.query.employee
  }

  const absences = await Absence.find(filter)
    .populate("employee", "name email")
    .populate("createdBy", "name")
    .sort({ startDate: -1 })

  res.json({ absences })
})

// ─── POST /api/calendar/absences ──────────────────────────────────────────────
export const createAbsence = asyncHandler(async (req, res, next) => {
  const { employee, startDate, endDate, type, reason } = req.body

  if (!employee || !startDate || !endDate) {
    return next(new AppError("employee, startDate and endDate are required", 400, "MISSING_FIELDS"))
  }
  if (!mongoose.isValidObjectId(employee)) {
    return next(new AppError("Invalid employee", 400, "INVALID_EMPLOYEE"))
  }

  const target = await User.findById(employee).select("isActive")
  if (!target || !target.isActive) {
    return next(new AppError("The selected employee is not an active user", 400, "INVALID_EMPLOYEE"))
  }
  if (!(await canManageAbsenceFor(req, employee))) {
    return next(new AppError("You can only record absence for your own team members", 403, "FORBIDDEN"))
  }

  const start = startOfDay(new Date(startDate))
  const end = startOfDay(new Date(endDate))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return next(new AppError("Invalid start or end date", 400, "INVALID_DATE"))
  }
  if (end < start) {
    return next(new AppError("The end date cannot be before the start date", 400, "INVALID_RANGE"))
  }
  // A mistyped year shouldn't zero someone's capacity for a decade.
  const MAX_RANGE_DAYS = 90
  const rangeDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1
  if (rangeDays > MAX_RANGE_DAYS) {
    return next(new AppError(`An absence cannot be longer than ${MAX_RANGE_DAYS} days`, 400, "RANGE_TOO_LONG"))
  }
  if (type && !["leave", "sick", "holiday", "half_day"].includes(type)) {
    return next(new AppError("Invalid absence type", 400, "INVALID_TYPE"))
  }
  if (type === "half_day" && rangeDays > 1) {
    return next(new AppError("A half day must be a single date", 400, "INVALID_RANGE"))
  }

  // Overlapping active absences for the same person would make capacity ambiguous.
  const overlapping = await Absence.findOne({
    employee,
    isActive: true,
    startDate: { $lte: end },
    endDate: { $gte: start }
  })
  if (overlapping) {
    return next(new AppError("This overlaps an absence already recorded for that person", 409, "ABSENCE_OVERLAP"))
  }

  const absence = await Absence.create({
    employee,
    startDate: start,
    endDate: end,
    type: type || "leave",
    reason: reason?.trim() || "",
    createdBy: req.user.id
  })

  const populated = await Absence.findById(absence._id)
    .populate("employee", "name email")
    .populate("createdBy", "name")

  res.status(201).json({ absence: populated })
})

// ─── DELETE /api/calendar/absences/:id ────────────────────────────────────────
export const deleteAbsence = asyncHandler(async (req, res, next) => {
  const absence = await Absence.findById(req.params.id)
  if (!absence || !absence.isActive) {
    return next(new AppError("Absence not found", 404, "ABSENCE_NOT_FOUND"))
  }
  if (!(await canManageAbsenceFor(req, absence.employee))) {
    return next(new AppError("You can only remove absence for your own team members", 403, "FORBIDDEN"))
  }

  // Soft-delete (Core Rule 2) — past reports must still explain historical capacity.
  absence.isActive = false
  await absence.save()

  res.json({ success: true, message: "Absence removed", absenceId: absence._id })
})
