import { describe, it, expect, beforeEach, afterEach } from "vitest"
import Task from "../../../models/Task.js"
import { buildScopeFilter } from "../../../services/taskScopeService.js"
import { isTaskInScope } from "@frontend/lib/taskScope.js"
import { makeUser, makeTask, makeDailyTask } from "../../factories/index.js"
import { freezeTime, restoreTime } from "../../helpers/clock.js"

// MIRROR CONTRACT: "what counts as today's work" is implemented twice.
//
//   Backend  services/taskScopeService.js  buildScopeFilter — a Mongo $or, applied by
//            GET /api/tasks?scope= for the employee dashboard.
//   Frontend lib/taskScope.js              isTaskInScope    — a JS predicate, applied
//            locally by the manager's Team Tasks table (which cannot scope its fetch,
//            because the same task array feeds the capacity bars and 7-day forecast).
//
// THIS IS THE PAIR THAT ALREADY CAUSED A PRODUCTION BUG. Matching daily tasks on
// `dailyDate` within the window meant that when the provisioning cron was behind,
// unfinished daily tasks kept a stale dailyDate and vanished from the employee's Today
// view — hiding today's work in exactly the failure mode where you most need to see it.
// The live database had 14 such tasks.
//
// This test lives in integration rather than unit because only a real MongoDB can
// evaluate the server-side filter. Both sides are fed the identical fixture set and
// must select the identical task IDs.

const REFERENCE = new Date(2026, 2, 16, 14, 30) // Monday 16 March 2026, mid-afternoon
const daysFrom = (n, hour = 12) => new Date(2026, 2, 16 + n, hour)

// Mongoose stamps `updatedAt` itself, so a fixture needing a specific one is corrected
// afterwards with timestamps disabled.
const setUpdatedAt = (task, when) =>
  Task.updateOne({ _id: task._id }, { $set: { updatedAt: when } }, { timestamps: false })

describe("scope agreement", () => {
  let employee
  let fixtures

  beforeEach(async () => {
    freezeTime(REFERENCE)
    employee = await makeUser({ role: "employee" })

    // One fixture per reason a task can be in or out of scope, plus the awkward ones.
    fixtures = {
      // ── daily ────────────────────────────────────────────────────────────────
      incompleteDailyStaleDate: await makeDailyTask({
        assignedTo: employee, title: "Incomplete daily, stale dailyDate",
        dailyDate: daysFrom(-30), status: "Not Started"
      }),
      incompleteDailyToday: await makeDailyTask({
        assignedTo: employee, title: "Incomplete daily, today", dailyDate: daysFrom(0)
      }),
      completedDailyToday: await makeDailyTask({
        assignedTo: employee, title: "Completed daily, today",
        dailyDate: daysFrom(0), status: "Completed"
      }),
      completedDailyLongAgo: await makeDailyTask({
        assignedTo: employee, title: "Completed daily, last month",
        dailyDate: daysFrom(-30), status: "Completed"
      }),

      // ── due dates ────────────────────────────────────────────────────────────
      overdueOpen: await makeTask({
        assignedTo: employee, title: "Overdue and open",
        dueDate: daysFrom(-10), status: "Not Started"
      }),
      dueToday: await makeTask({
        assignedTo: employee, title: "Due today", dueDate: daysFrom(0), status: "Not Started"
      }),
      dueLateToday: await makeTask({
        assignedTo: employee, title: "Due 23:59 today",
        dueDate: daysFrom(0, 23), status: "Not Started"
      }),
      dueInThreeDays: await makeTask({
        assignedTo: employee, title: "Due in three days", dueDate: daysFrom(3), status: "Not Started"
      }),
      dueNextMonth: await makeTask({
        assignedTo: employee, title: "Due next month", dueDate: daysFrom(30), status: "Not Started"
      }),

      // ── in flight, regardless of dates ────────────────────────────────────────
      inProgressNoDates: await makeTask({
        assignedTo: employee, title: "In progress, undated", status: "In Progress"
      }),
      pendingNoDates: await makeTask({
        assignedTo: employee, title: "Paused, undated", status: "Pending"
      }),
      inReviewNoDates: await makeTask({
        assignedTo: employee, title: "In review, undated", status: "In Review"
      }),

      // ── blocked ──────────────────────────────────────────────────────────────
      blockedUndated: await makeTask({
        assignedTo: employee, title: "Blocked, undated",
        status: "Not Started", isBlocked: true, blockedReason: "Waiting on design", blockedAt: daysFrom(-2)
      }),

      // ── completed ────────────────────────────────────────────────────────────
      completedToday: await makeTask({
        assignedTo: employee, title: "Completed today", status: "Completed"
      }),
      completedFourDaysAgo: await makeTask({
        assignedTo: employee, title: "Completed four days ago", status: "Completed"
      }),
      completedLongAgo: await makeTask({
        assignedTo: employee, title: "Completed long ago", status: "Completed"
      }),

      // ── out of scope entirely ────────────────────────────────────────────────
      notStartedUndated: await makeTask({
        assignedTo: employee, title: "Not started, undated, someday", status: "Not Started"
      })
    }

    await setUpdatedAt(fixtures.completedToday, daysFrom(0))
    await setUpdatedAt(fixtures.completedFourDaysAgo, daysFrom(-4))
    await setUpdatedAt(fixtures.completedLongAgo, daysFrom(-60))
    await setUpdatedAt(fixtures.completedDailyLongAgo, daysFrom(-30))
    await setUpdatedAt(fixtures.notStartedUndated, daysFrom(-60))
  })

  afterEach(() => restoreTime())

  const titleOf = (id) =>
    Object.entries(fixtures).find(([, t]) => t._id.toString() === id.toString())?.[0]

  const selectedByBackend = async (scope) => {
    const filter = buildScopeFilter(scope, REFERENCE)
    const query = filter ? { isActive: true, $and: [filter] } : { isActive: true }
    const found = await Task.find(query).select("_id").lean()
    return found.map(t => titleOf(t._id)).sort()
  }

  const selectedByFrontend = async (scope) => {
    const all = await Task.find({ isActive: true }).lean()
    return all.filter(t => isTaskInScope(t, scope, REFERENCE)).map(t => titleOf(t._id)).sort()
  }

  for (const scope of ["today", "week", "all"]) {
    it(`selects identical tasks on both sides for scope=${scope}`, async () => {
      // The assertion the whole file exists for.
      expect(await selectedByFrontend(scope)).toEqual(await selectedByBackend(scope))
    })
  }

  it("never hides an incomplete daily task, whatever its dailyDate", async () => {
    // Regression lock for the shipped bug.
    for (const scope of ["today", "week"]) {
      expect(await selectedByBackend(scope)).toContain("incompleteDailyStaleDate")
      expect(await selectedByFrontend(scope)).toContain("incompleteDailyStaleDate")
    }
  })

  it("never hides overdue open work", async () => {
    // The other half of the critical rule: a `dueDate === today` filter would drop
    // precisely the work that needs attention.
    for (const scope of ["today", "week"]) {
      expect(await selectedByBackend(scope)).toContain("overdueOpen")
    }
  })

  it("never hides work in flight or blocked, whatever its dates", async () => {
    const today = await selectedByBackend("today")
    expect(today).toEqual(expect.arrayContaining([
      "inProgressNoDates", "pendingNoDates", "inReviewNoDates", "blockedUndated"
    ]))
  })

  it("shows today's wins but not last month's", async () => {
    const today = await selectedByBackend("today")
    expect(today).toContain("completedToday")
    expect(today).toContain("completedDailyToday")
    expect(today).not.toContain("completedLongAgo")
    expect(today).not.toContain("completedDailyLongAgo")
  })

  it("keeps genuinely future and dormant work out of Today", async () => {
    const today = await selectedByBackend("today")
    expect(today).not.toContain("dueNextMonth")
    expect(today).not.toContain("dueInThreeDays")
    expect(today).not.toContain("notStartedUndated")
  })

  it("widens correctly from today to this week", async () => {
    const today = await selectedByBackend("today")
    const week = await selectedByBackend("week")

    // A week is a superset of a day.
    expect(week).toEqual(expect.arrayContaining(today))
    // and it reaches further in both directions.
    expect(week).toContain("dueInThreeDays")
    expect(week).toContain("completedFourDaysAgo")
    expect(today).not.toContain("completedFourDaysAgo")
    // but still not to next month.
    expect(week).not.toContain("dueNextMonth")
  })

  it("includes a task due at 23:59 today in Today", async () => {
    // An exclusive upper bound at start-of-tomorrow must still admit the last minute
    // of today, or end-of-day deadlines silently disappear.
    expect(await selectedByBackend("today")).toContain("dueLateToday")
    expect(await selectedByFrontend("today")).toContain("dueLateToday")
  })

  it("returns everything for scope=all", async () => {
    expect(await selectedByBackend("all")).toHaveLength(Object.keys(fixtures).length)
  })
})
