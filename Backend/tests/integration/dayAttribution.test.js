import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { asUser } from "../helpers/api.js"
import { freezeTime, restoreTime } from "../helpers/clock.js"
import { buildOrg, makeTask, makeSession, makeStoppedSession } from "../factories/index.js"

// THE DAY-ATTRIBUTION RULE, pinned.
//
// A work session belongs entirely to the local day it STARTED — never split at midnight,
// never moved to the day it ended. See workSessionController.getTodayTrackedHours for
// why that was chosen over the alternatives.
//
// Before these tests the behaviour was an accident of `startedAt >= startOfDay` rather
// than a decision anyone had made or written down. It is now a decision, and changing it
// has to break something.

// Monday 16 March 2026, 10:00 local.
const NOW = new Date(2026, 2, 16, 10, 0)
const at = (day, hour, minute = 0) => new Date(2026, 2, day, hour, minute)
const HOUR = 3600

describe("day attribution for tracked hours", () => {
  let org, task

  beforeEach(async () => {
    freezeTime(NOW)
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 })
  })

  afterEach(() => restoreTime())

  const todayHours = async () =>
    (await asUser(org.employeeA1).get("/api/work-sessions/today-hours").expect(200)).body.hoursWorked

  it("counts a session started and finished today", async () => {
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 2 * HOUR, startedAt: at(16, 8) })
    expect(await todayHours()).toBe(2)
  })

  it("does not count yesterday work", async () => {
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 3 * HOUR, startedAt: at(15, 9) })
    expect(await todayHours()).toBe(0)
  })

  it("attributes a session that crossed midnight to the day it STARTED", async () => {
    // Started 23:30 yesterday, stopped 00:30 today. All of it is yesterday.
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: HOUR, startedAt: at(15, 23, 30) })
    expect(await todayHours()).toBe(0)
  })

  it("shows nothing for a timer that has been running since before midnight", async () => {
    // The accepted consequence, asserted rather than left to be discovered: a running
    // clock beside "0h today". Correct by the rule, and genuinely surprising.
    await makeSession({ task, employee: org.employeeA1, startedAt: at(15, 23, 30) })
    expect(await todayHours()).toBe(0)
  })

  it("counts a still-running session that started today", async () => {
    await makeSession({ task, employee: org.employeeA1, startedAt: at(16, 8) })
    expect(await todayHours()).toBe(2)
  })

  it("counts a session started one minute after midnight", async () => {
    // The other side of the same boundary.
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: HOUR, startedAt: at(16, 0, 1) })
    expect(await todayHours()).toBe(1)
  })

  it("sums several sessions from today", async () => {
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: HOUR, startedAt: at(16, 8) })
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 0.5 * HOUR, startedAt: at(16, 9) })
    expect(await todayHours()).toBe(1.5)
  })

  it("counts only the caller own sessions", async () => {
    const other = await makeTask({ assignedTo: org.employeeA2 })
    await makeStoppedSession({ task: other, employee: org.employeeA2, seconds: 5 * HOUR, startedAt: at(16, 8) })
    expect(await todayHours()).toBe(0)
  })

  it("uses the same rule for the work-log prefill, so the two agree", async () => {
    // The prefill exists to make the log a review rather than a retype. If it disagreed
    // with the hours figure shown elsewhere, it would create the doubt it removes.
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 2 * HOUR, startedAt: at(16, 8) })
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 4 * HOUR, startedAt: at(15, 9) })

    const context = await asUser(org.employeeA1).get("/api/daily-work-logs/today-context").expect(200)
    expect(context.body.trackedHours).toBe(await todayHours())
    expect(context.body.trackedHours).toBe(2)
  })

  it("uses the same rule for the date-filtered report", async () => {
    // A session started before the range belongs to an earlier period, so it stays out
    // even though part of its clock ran inside the range. Reporting it in both would
    // double-count the same hours.
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 2 * HOUR, startedAt: at(16, 8) })
    await makeStoppedSession({ task, employee: org.employeeA1, seconds: 4 * HOUR, startedAt: at(15, 23, 30) })

    const res = await asUser(org.managerA)
      .get("/api/tasks/report?startDate=2026-03-16&endDate=2026-03-16")
      .expect(200)
    const row = res.body.employeeReport.find(r => r._id === org.employeeA1._id.toString())

    expect(row.totalTrackedSeconds).toBe(2 * HOUR)
  })
})
