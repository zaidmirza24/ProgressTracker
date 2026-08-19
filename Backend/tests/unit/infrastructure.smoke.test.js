import { describe, it, expect, afterEach } from "vitest"
import { isValidTransition, TASK_STATUSES } from "../../config/workflow.js"
import { isTaskInScope } from "@frontend/lib/taskScope.js"
import { freezeTime, advanceTimeByHours, restoreTime, startOfLocalDay } from "../helpers/clock.js"

// Verifies the FAST path works: pure modules load, the cross-package alias resolves,
// and the clock helper is deterministic. Nothing here may touch the database — that is
// the rule that keeps `npm run test:unit` under a few seconds.
//
// This file is infrastructure verification, not the workflow/scope suite. The real
// coverage of these modules arrives with the P0 unit phase.

describe("unit test infrastructure", () => {
  afterEach(() => restoreTime())

  it("loads backend source modules under test", () => {
    expect(TASK_STATUSES).toHaveLength(5)
    expect(isValidTransition("employee", true, "Not Started", "In Progress")).toBe(true)
  })

  it("resolves the @frontend alias, so mirror-contract tests can compare both sides", () => {
    // Proves the cross-package import works. The actual agreement assertions between
    // this and buildScopeFilter belong in tests/integration/contracts/ (they need a
    // real Mongo query to evaluate the server-side filter).
    const blockedTask = { isBlocked: true, status: "Not Started" }
    expect(isTaskInScope(blockedTask, "today")).toBe(true)
  })

  it("pins the clock so date-dependent code is deterministic", () => {
    freezeTime("2026-03-10T09:00:00.000Z")
    const first = Date.now()

    advanceTimeByHours(3)
    expect(Date.now() - first).toBe(3 * 60 * 60 * 1000)

    // Real timers must keep working while Date is faked — the MongoDB driver depends
    // on them, which is why clock.js fakes Date only.
    return new Promise(resolve => setTimeout(resolve, 1)).then(() => {
      expect(startOfLocalDay().getHours()).toBe(0)
    })
  })
})
