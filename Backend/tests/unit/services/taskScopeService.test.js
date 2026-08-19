import { describe, it, expect } from "vitest"
import { buildScopeFilter, TASK_SCOPES } from "../../../services/taskScopeService.js"

// The Mongo filter behind `GET /api/tasks?scope=today|week`.
//
// THE CRITICAL RULE this encodes: "today" must include OVERDUE open work. A naive
// `dueDate === today` filter would hide exactly the tasks that need attention and
// silently break the overdue signal on the primary screen.
//
// This file asserts the FILTER SHAPE and its date boundaries. That the filter and its
// frontend mirror select the same tasks is asserted separately, against a real database,
// in tests/integration/contracts/scope-agreement.test.js.

// Monday 16 March 2026, mid-afternoon. Local constructor — see calendarService.test.js.
const REFERENCE = new Date(2026, 2, 16, 14, 30)

const clausesOf = (scope) => buildScopeFilter(scope, REFERENCE).$or
const clauseWith = (scope, predicate) => clausesOf(scope).find(predicate)

describe("TASK_SCOPES", () => {
  it("offers exactly today, week and all", () => {
    expect(TASK_SCOPES).toEqual(["today", "week", "all"])
  })
})

describe("buildScopeFilter — no constraint", () => {
  it("returns null for 'all', so the query is unrestricted", () => {
    expect(buildScopeFilter("all", REFERENCE)).toBeNull()
  })

  it("returns null when no scope is given, preserving the original all-time behaviour", () => {
    expect(buildScopeFilter(undefined, REFERENCE)).toBeNull()
    expect(buildScopeFilter(null, REFERENCE)).toBeNull()
    expect(buildScopeFilter("", REFERENCE)).toBeNull()
  })
})

describe("buildScopeFilter — clause coverage", () => {
  for (const scope of ["today", "week"]) {
    describe(`scope=${scope}`, () => {
      it("is a disjunction — a task qualifies on any single ground", () => {
        const filter = buildScopeFilter(scope, REFERENCE)
        expect(Object.keys(filter)).toEqual(["$or"])
        expect(filter.$or).toHaveLength(6)
      })

      it("includes every incomplete daily task regardless of its dailyDate", () => {
        // The clause that fixes the shipped bug: daily tasks carry forward by design,
        // so an unfinished one is always current work. Matching on dailyDate hid 14
        // real tasks when the provisioning cron was behind — i.e. it hid today's work
        // in exactly the failure mode where you most need to see it.
        const clause = clauseWith(scope, c => c.isDaily === true && c.status?.$ne === "Completed")
        expect(clause).toBeDefined()
        expect(clause.dailyDate).toBeUndefined()
      })

      it("includes open work due before the horizon, which is what keeps overdue visible", () => {
        // `$lt: horizonEnd` with no lower bound — a task due last month still matches.
        const clause = clauseWith(scope, c => c.dueDate !== undefined)
        expect(clause.status.$ne).toBe("Completed")
        expect(clause.dueDate.$ne).toBeNull()
        expect(clause.dueDate.$gte).toBeUndefined()
      })

      it("includes anything actively in flight, whatever its dates", () => {
        // Also what keeps a running timer's task visible: starting a timer sets the
        // task to In Progress, so no work-session lookup is needed here.
        const clause = clauseWith(scope, c => Array.isArray(c.status?.$in))
        expect(clause.status.$in).toEqual(["In Progress", "Pending", "In Review"])
        expect(Object.keys(clause)).toEqual(["status"])
      })

      it("includes blocked work unconditionally", () => {
        expect(clausesOf(scope)).toContainEqual({ isBlocked: true })
      })

      it("includes work completed inside the window, so today's wins still show", () => {
        const clause = clauseWith(scope, c => c.status === "Completed")
        expect(clause.updatedAt.$gte).toBeInstanceOf(Date)
      })
    })
  }
})

describe("buildScopeFilter — date boundaries", () => {
  const boundsFor = (scope) => {
    const completed = clauseWith(scope, c => c.status === "Completed")
    const dueClause = clauseWith(scope, c => c.dueDate !== undefined)
    return { windowStart: completed.updatedAt.$gte, horizonEnd: dueClause.dueDate.$lt }
  }

  it("scopes 'today' to the current local day", () => {
    const { windowStart, horizonEnd } = boundsFor("today")
    // Start of today, up to but excluding start of tomorrow.
    expect(windowStart).toEqual(new Date(2026, 2, 16))
    expect(horizonEnd).toEqual(new Date(2026, 2, 17))
  })

  it("scopes 'week' to the seven days either side", () => {
    const { windowStart, horizonEnd } = boundsFor("week")
    expect(windowStart).toEqual(new Date(2026, 2, 9))
    expect(horizonEnd).toEqual(new Date(2026, 2, 24))
  })

  it("normalises the reference time away, so the result does not depend on time of day", () => {
    const earlyMorning = buildScopeFilter("today", new Date(2026, 2, 16, 0, 1))
    const lateNight = buildScopeFilter("today", new Date(2026, 2, 16, 23, 59))
    expect(JSON.stringify(earlyMorning)).toBe(JSON.stringify(lateNight))
  })

  it("uses the same window start for the completed and daily clauses", () => {
    // Both describe "inside the window"; if they drifted apart, a daily task completed
    // today could vanish from Today while a non-daily one stayed.
    for (const scope of ["today", "week"]) {
      const completed = clauseWith(scope, c => c.status === "Completed")
      const dailyDated = clauseWith(scope, c => c.isDaily === true && c.dailyDate !== undefined)
      expect(dailyDated.dailyDate.$gte).toEqual(completed.updatedAt.$gte)
    }
  })

  it("defaults the reference date to now when none is supplied", () => {
    const filter = buildScopeFilter("today")
    const completed = filter.$or.find(c => c.status === "Completed")
    const today = new Date()
    expect(completed.updatedAt.$gte).toEqual(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  })
})
