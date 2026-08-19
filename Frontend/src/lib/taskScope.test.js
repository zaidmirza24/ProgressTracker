import { describe, it, expect } from "vitest"
import { isTaskInScope, filterTasksByScope, TASK_SCOPES, SCOPE_LABELS } from "./taskScope"

// The client-side mirror of Backend/services/taskScopeService.js, used by the manager's
// Team Tasks table — which filters LOCALLY because the same task array also feeds the
// capacity bars and the 7-day forecast, so scoping the fetch would starve them of
// future-dated work.
//
// That the two implementations select the same tasks is asserted against a real
// database in Backend/tests/integration/contracts/scope-agreement.test.js. This file
// covers the predicate's own branches.

const REFERENCE = new Date(2026, 2, 16, 14, 30) // Monday 16 March 2026
const daysFrom = (n, hour = 12) => new Date(2026, 2, 16 + n, hour)

const inToday = (task) => isTaskInScope(task, "today", REFERENCE)
const inWeek = (task) => isTaskInScope(task, "week", REFERENCE)

describe("scope metadata", () => {
  it("offers exactly today, week and all", () => {
    expect(TASK_SCOPES).toEqual(["today", "week", "all"])
  })

  it("labels every scope for the UI", () => {
    for (const scope of TASK_SCOPES) {
      expect(SCOPE_LABELS[scope]).toBeTruthy()
    }
  })
})

describe("isTaskInScope — everything is in scope for 'all'", () => {
  it("admits any task", () => {
    expect(isTaskInScope({ status: "Not Started" }, "all", REFERENCE)).toBe(true)
    expect(isTaskInScope({ status: "Completed", updatedAt: daysFrom(-500) }, "all", REFERENCE)).toBe(true)
  })

  it("treats a missing scope as 'all'", () => {
    expect(isTaskInScope({ status: "Not Started" }, undefined, REFERENCE)).toBe(true)
    expect(isTaskInScope({ status: "Not Started" }, null, REFERENCE)).toBe(true)
  })
})

describe("isTaskInScope — daily tasks", () => {
  it("admits an incomplete daily task whatever its dailyDate", () => {
    // The rule that fixes the shipped bug: daily tasks carry forward by design, so an
    // unfinished one is always current work — and when provisioning is behind, its
    // dailyDate is stale precisely when the work is most outstanding.
    expect(inToday({ isDaily: true, status: "Not Started", dailyDate: daysFrom(-30) })).toBe(true)
    expect(inToday({ isDaily: true, status: "Not Started", dailyDate: null })).toBe(true)
  })

  it("admits a daily task completed today", () => {
    expect(inToday({ isDaily: true, status: "Completed", dailyDate: daysFrom(0) })).toBe(true)
  })

  it("excludes a daily task completed long ago", () => {
    expect(inToday({ isDaily: true, status: "Completed", dailyDate: daysFrom(-30), updatedAt: daysFrom(-30) })).toBe(false)
  })
})

describe("isTaskInScope — due dates", () => {
  it("admits overdue open work", () => {
    // The critical rule. A `dueDate === today` filter would hide exactly the work that
    // needs attention.
    expect(inToday({ status: "Not Started", dueDate: daysFrom(-10) })).toBe(true)
  })

  it("admits work due today, including late in the day", () => {
    expect(inToday({ status: "Not Started", dueDate: daysFrom(0) })).toBe(true)
    expect(inToday({ status: "Not Started", dueDate: daysFrom(0, 23) })).toBe(true)
  })

  it("excludes work due beyond the horizon", () => {
    expect(inToday({ status: "Not Started", dueDate: daysFrom(3) })).toBe(false)
    expect(inWeek({ status: "Not Started", dueDate: daysFrom(3) })).toBe(true)
    expect(inWeek({ status: "Not Started", dueDate: daysFrom(30) })).toBe(false)
  })

  it("does not admit completed work merely because it was due in range", () => {
    expect(inToday({ status: "Completed", dueDate: daysFrom(0), updatedAt: daysFrom(-60) })).toBe(false)
  })
})

describe("isTaskInScope — work in flight", () => {
  for (const status of ["In Progress", "Pending", "In Review"]) {
    it(`admits ${status} work regardless of dates`, () => {
      // Also what keeps a running timer's task visible, since starting a timer sets the
      // task to In Progress.
      expect(inToday({ status })).toBe(true)
    })
  }
})

describe("isTaskInScope — blocked work", () => {
  it("admits blocked work unconditionally", () => {
    expect(inToday({ status: "Not Started", isBlocked: true })).toBe(true)
  })
})

describe("isTaskInScope — completed work", () => {
  it("admits work completed inside the window, so today's wins still show", () => {
    expect(inToday({ status: "Completed", updatedAt: daysFrom(0) })).toBe(true)
  })

  it("excludes work completed before the window", () => {
    expect(inToday({ status: "Completed", updatedAt: daysFrom(-4) })).toBe(false)
    expect(inWeek({ status: "Completed", updatedAt: daysFrom(-4) })).toBe(true)
    expect(inWeek({ status: "Completed", updatedAt: daysFrom(-30) })).toBe(false)
  })
})

describe("isTaskInScope — out of scope", () => {
  it("excludes dormant, undated, not-started work", () => {
    expect(inToday({ status: "Not Started" })).toBe(false)
    expect(inWeek({ status: "Not Started" })).toBe(false)
  })
})

describe("filterTasksByScope", () => {
  const tasks = [
    { _id: "overdue", status: "Not Started", dueDate: daysFrom(-5) },
    { _id: "dormant", status: "Not Started" },
    { _id: "running", status: "In Progress" },
    { _id: "future", status: "Not Started", dueDate: daysFrom(40) }
  ]

  it("narrows to the tasks in scope", () => {
    expect(filterTasksByScope(tasks, "today", REFERENCE).map(t => t._id)).toEqual(["overdue", "running"])
  })

  it("returns the array untouched for 'all' or no scope", () => {
    expect(filterTasksByScope(tasks, "all", REFERENCE)).toBe(tasks)
    expect(filterTasksByScope(tasks, undefined, REFERENCE)).toBe(tasks)
  })

  it("copes with an empty list", () => {
    expect(filterTasksByScope([], "today", REFERENCE)).toEqual([])
  })
})
