import { describe, it, expect, beforeEach } from "vitest"
import Task from "../../models/Task.js"
import { buildOrg, makeTemplate, makeDailyTask, setOrgSettings } from "../factories/index.js"
import { provisionDailyTasksForEmployee } from "../../services/dailyTaskService.js"
import { startOfLocalDay } from "../helpers/clock.js"

// REGRESSION — CLAUDE.md Iteration 13 (2026-08-16).
//
// The bug: dailyTaskService ran its template-creation loop BEFORE its carry-forward
// loop. On any day an employee still had an incomplete daily task from a prior day, a
// brand-new "Not Started" instance was created for today, and then the carry-forward
// loop found that just-created task and skipped re-stamping the old one — so BOTH
// stayed active. The employee, their manager and the admin workload views all showed
// visible duplicates ("Morning Standup Sync" twice).
//
// It had been silently accumulating every day since a template was created four days
// earlier, and required a one-off cleanup of the live database.
//
// The fix: run carry-forward FIRST, so the "does today's task already exist" check sees
// the re-stamped task.
//
// Related but distinct: two provisioning runs racing each other can still produce
// duplicates through a different route (findOne-then-create with no uniqueness
// constraint). That gap is documented in tests/integration/concurrency.test.js.

const activeFor = (employeeId, templateId) =>
  Task.find({ assignedTo: employeeId, templateRef: templateId, isActive: true })

describe("regression: daily tasks are carried forward, never duplicated", () => {
  let org, template

  beforeEach(async () => {
    // Provisioning is calendar-aware and skips non-working days; these tests use the
    // real clock, so every day must be a working day for the result to be stable.
    await setOrgSettings({ workingDays: [0, 1, 2, 3, 4, 5, 6] })
    org = await buildOrg()
    template = await makeTemplate({ createdBy: org.superAdmin, title: "Morning Standup Sync" })
  })

  it("re-stamps yesterday's incomplete task instead of creating a second one", async () => {
    const yesterday = new Date(startOfLocalDay())
    yesterday.setDate(yesterday.getDate() - 1)

    const carried = await makeDailyTask({
      assignedTo: org.employeeA1,
      title: "Morning Standup Sync",
      templateRef: template,
      dailyDate: yesterday,
      originalDailyDate: yesterday,
      status: "Not Started"
    })

    await provisionDailyTasksForEmployee(org.employeeA1._id)

    const active = await activeFor(org.employeeA1._id, template._id)
    expect(active).toHaveLength(1)
    expect(active[0]._id.toString()).toBe(carried._id.toString())
  })

  it("marks the carried task as carried forward and keeps its true origin date", async () => {
    // Locked Logic §8 — a carried-forward task must never be counted as brand new, and
    // the manager needs to see how long it has been rolling over.
    const threeDaysAgo = new Date(startOfLocalDay())
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    await makeDailyTask({
      assignedTo: org.employeeA1,
      templateRef: template,
      dailyDate: threeDaysAgo,
      originalDailyDate: threeDaysAgo,
      status: "In Progress"
    })

    await provisionDailyTasksForEmployee(org.employeeA1._id)

    const [task] = await activeFor(org.employeeA1._id, template._id)
    expect(task.isCarryForward).toBe(true)
    expect(startOfLocalDay(task.dailyDate)).toEqual(startOfLocalDay())          // moved to today
    expect(startOfLocalDay(task.originalDailyDate)).toEqual(startOfLocalDay(threeDaysAgo)) // origin kept
  })

  it("does not duplicate across several consecutive days of carry-forward", async () => {
    // The original bug compounded: one extra task per day, every day.
    const fourDaysAgo = new Date(startOfLocalDay())
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4)

    await makeDailyTask({
      assignedTo: org.employeeA1,
      templateRef: template,
      dailyDate: fourDaysAgo,
      originalDailyDate: fourDaysAgo,
      status: "Not Started"
    })

    for (let day = 0; day < 4; day++) {
      await provisionDailyTasksForEmployee(org.employeeA1._id)
    }

    expect(await activeFor(org.employeeA1._id, template._id)).toHaveLength(1)
  })

  it("creates today's task when yesterday's was completed", async () => {
    // Completed work does not carry forward — today needs a fresh instance.
    const yesterday = new Date(startOfLocalDay())
    yesterday.setDate(yesterday.getDate() - 1)

    const finished = await makeDailyTask({
      assignedTo: org.employeeA1,
      templateRef: template,
      dailyDate: yesterday,
      originalDailyDate: yesterday,
      status: "Completed"
    })

    await provisionDailyTasksForEmployee(org.employeeA1._id)

    const active = await activeFor(org.employeeA1._id, template._id)
    expect(active).toHaveLength(2) // yesterday's completed record, plus today's new one
    const today = active.find(t => t._id.toString() !== finished._id.toString())
    expect(today.isCarryForward).toBe(false)
    expect(startOfLocalDay(today.dailyDate)).toEqual(startOfLocalDay())
  })

  it("replaces a daily task that was cancelled earlier today", async () => {
    // A soft-cancelled instance must not count as "already exists", or the employee is
    // left with no task at all for that template today.
    await provisionDailyTasksForEmployee(org.employeeA1._id)
    const [first] = await activeFor(org.employeeA1._id, template._id)
    await Task.updateOne({ _id: first._id }, { isActive: false })

    await provisionDailyTasksForEmployee(org.employeeA1._id)

    const active = await activeFor(org.employeeA1._id, template._id)
    expect(active).toHaveLength(1)
    expect(active[0]._id.toString()).not.toBe(first._id.toString())
  })
})
