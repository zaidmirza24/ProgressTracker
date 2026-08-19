import Department from "../../models/Department.js"
import Team from "../../models/Team.js"
import TaskTemplate from "../../models/TaskTemplate.js"
import Absence from "../../models/Absence.js"
import OrgSettings from "../../models/OrgSettings.js"
import DailyWorkLog from "../../models/DailyWorkLog.js"
import { startOfLocalDay } from "../helpers/clock.js"

const idOf = (doc) => doc?._id ?? doc

let sequence = 0

export const makeDepartment = (overrides = {}) =>
  Department.create({
    name: overrides.name ?? `Department ${++sequence}`,
    description: overrides.description ?? "",
    isActive: overrides.isActive ?? true
  })

export const makeTeam = (overrides = {}) => {
  const department = idOf(overrides.department)
  if (!department) throw new Error("makeTeam requires a department")
  return Team.create({
    name: overrides.name ?? `Team ${++sequence}`,
    department,
    description: overrides.description ?? "",
    isActive: overrides.isActive ?? true
  })
}

export const makeTemplate = (overrides = {}) => {
  const createdBy = idOf(overrides.createdBy)
  if (!createdBy) throw new Error("makeTemplate requires createdBy")
  const scope = overrides.scope ?? "global"
  return TaskTemplate.create({
    title: overrides.title ?? `Daily template ${++sequence}`,
    description: overrides.description ?? "",
    category: overrides.category ?? "Daily",
    priority: overrides.priority ?? "medium",
    estimatedHours: overrides.estimatedHours ?? 1,
    scope,
    departments: scope === "department" ? (overrides.departments ?? []).map(idOf) : [],
    employees: scope === "employees" ? (overrides.employees ?? []).map(idOf) : [],
    isActive: overrides.isActive ?? true,
    createdBy
  })
}

/**
 * An absence. Both dates are inclusive and normalised to local start-of-day, exactly
 * as calendarController does on write — a factory that stored raw timestamps would
 * make range comparisons pass in tests and fail in production.
 */
export const makeAbsence = (overrides = {}) => {
  const employee = idOf(overrides.employee)
  const createdBy = idOf(overrides.createdBy)
  if (!employee || !createdBy) throw new Error("makeAbsence requires employee and createdBy")
  const startDate = startOfLocalDay(overrides.startDate ?? new Date())
  return Absence.create({
    employee,
    startDate,
    endDate: startOfLocalDay(overrides.endDate ?? startDate),
    type: overrides.type ?? "leave",
    reason: overrides.reason ?? "",
    createdBy,
    isActive: overrides.isActive ?? true
  })
}

/**
 * Set the org work calendar. Defaults match the schema (Mon–Fri, no holidays,
 * Asia/Kolkata). calendarService caches this for 60s — testDb.js invalidates that
 * cache before every test, so a calendar written here is always the one read back.
 */
export const setOrgSettings = async (overrides = {}) => {
  const settings = await OrgSettings.getSingleton()
  if (overrides.workingDays !== undefined) settings.workingDays = overrides.workingDays
  if (overrides.holidays !== undefined) {
    settings.holidays = overrides.holidays.map(h => ({ date: startOfLocalDay(h.date), name: h.name }))
  }
  if (overrides.timezone !== undefined) settings.timezone = overrides.timezone
  await settings.save()
  return settings
}

export const makeWorkLog = (overrides = {}) => {
  const employee = idOf(overrides.employee)
  if (!employee) throw new Error("makeWorkLog requires employee")
  const date = overrides.date ?? new Date()
  return DailyWorkLog.create({
    employee,
    date,
    logDate: overrides.logDate ?? startOfLocalDay(date),
    todaysWork: overrides.todaysWork ?? "Worked on test fixtures",
    hoursWorked: overrides.hoursWorked ?? 7,
    tasksCompleted: overrides.tasksCompleted ?? "",
    problemsFaced: overrides.problemsFaced ?? "",
    nextPlan: overrides.nextPlan ?? "",
    remarks: overrides.remarks ?? ""
  })
}
