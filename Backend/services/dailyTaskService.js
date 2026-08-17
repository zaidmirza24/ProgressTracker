import Task from "../models/Task.js"
import User from "../models/User.js"
import TaskTemplate from "../models/TaskTemplate.js"
import { getOrgSettings, isWorkingDay, getAbsencesInRange, getAbsenceForDay } from "./calendarService.js"

// Single source of truth for daily-task provisioning (Locked Logic §1/§8), shared by
// the employee-triggered GET /api/tasks/daily route and the midnight cron job — do not
// duplicate this logic elsewhere.
//
// Calendar-aware: nothing is provisioned on a non-working day (weekend/holiday) or for
// someone who is away. Previously this ran every calendar day, so weekend tasks piled
// up as carry-forwards and dragged down every completion and backlog metric.
//
// Carry-forward across a weekend needs no special handling: provisioning simply doesn't
// run, so Friday's incomplete task keeps its dailyDate over the weekend and is
// re-stamped by the carry-forward loop on Monday.
export const provisionDailyTasksForEmployee = async (employeeId, context = null) => {
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  // Callers looping over the whole org pass a shared context so the settings/absences
  // aren't re-fetched per employee.
  const settings = context?.settings || await getOrgSettings()
  if (!isWorkingDay(startOfToday, settings)) return

  const user = await User.findById(employeeId)
  if (!user || !user.isActive) return

  // A half day still gets its tasks — only a full absence skips provisioning.
  const absences = context?.absences || await getAbsencesInRange(startOfToday, startOfToday, [employeeId])
  const absence = getAbsenceForDay(employeeId, startOfToday, absences)
  if (absence && absence.type !== "half_day") return

  const templateFilter = {
    isActive: true,
    $or: [
      { scope: "global" },
      { scope: "department", departments: user.department },
      { scope: "employees", employees: employeeId }
    ]
  }
  const templates = await TaskTemplate.find(templateFilter)

  // Carry forward uncompleted daily tasks from previous days FIRST, so the
  // "does today's task already exist" check below sees the re-stamped task and
  // doesn't spawn a duplicate alongside it (Locked Logic §8 — carried-forward tasks
  // must never be counted as/appear as brand-new).
  const incompletePastDailyTasks = await Task.find({
    assignedTo: employeeId,
    isDaily: true,
    isActive: true,
    dailyDate: { $lt: startOfToday },
    status: { $nin: ["Completed"] }
  })

  for (const t of incompletePastDailyTasks) {
    if (t.templateRef) {
      // isActive: true matters here — otherwise a soft-cancelled instance for today
      // (see cancelTask) still counts as "already exists," so neither this loop nor
      // the fresh-instantiation loop below creates a replacement, leaving the employee
      // with no task at all for this template today.
      const alreadyCarried = await Task.findOne({
        assignedTo: employeeId,
        templateRef: t.templateRef,
        isActive: true,
        dailyDate: { $gte: startOfToday, $lt: endOfToday }
      })
      if (!alreadyCarried) {
        t.dailyDate = startOfToday
        t.isCarryForward = true
        await t.save()
      }
    }
  }

  for (const tpl of templates) {
    // Same isActive: true reasoning as the carry-forward check above.
    const exists = await Task.findOne({
      assignedTo: employeeId,
      templateRef: tpl._id,
      isActive: true,
      dailyDate: { $gte: startOfToday, $lt: endOfToday }
    })
    if (!exists) {
      await Task.create({
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        priority: tpl.priority,
        estimatedHours: tpl.estimatedHours,
        assignedBy: employeeId, // self-assigned daily
        assignedTo: employeeId,
        department: user.department || null,
        status: "Not Started",
        progressPercentage: 0,
        isDaily: true,
        templateRef: tpl._id,
        dailyDate: startOfToday,
        originalDailyDate: startOfToday
      })
    }
  }
}

// Runs provisioning for every active worker — employees, managers, and super_admins
// alike, since "having daily tasks" is a worker responsibility, not an employee-only
// one (managers/admins can have their own daily tasks too). Used by the midnight cron
// so today's daily tasks (and capacity numbers derived from them) exist before anyone
// logs in. Settings and absences are fetched once and shared across the loop rather
// than re-queried per employee.
export const provisionDailyTasksForAllEmployees = async () => {
  const settings = await getOrgSettings()
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  if (!isWorkingDay(startOfToday, settings)) {
    console.log("Daily task provisioning skipped: today is not a working day.")
    return
  }

  const employees = await User.find({ role: { $in: ["employee", "manager", "super_admin"] }, isActive: true }).select("_id")
  const absences = await getAbsencesInRange(startOfToday, startOfToday, employees.map(e => e._id))
  const context = { settings, absences }

  let succeeded = 0
  let failed = 0
  let skipped = 0
  for (const emp of employees) {
    const absence = getAbsenceForDay(emp._id, startOfToday, absences)
    if (absence && absence.type !== "half_day") {
      skipped++
      continue
    }
    try {
      await provisionDailyTasksForEmployee(emp._id, context)
      succeeded++
    } catch (err) {
      failed++
      console.error(`Daily task provisioning failed for employee ${emp._id}:`, err.message)
    }
  }
  console.log(`Daily task provisioning complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped (away)`)
}
