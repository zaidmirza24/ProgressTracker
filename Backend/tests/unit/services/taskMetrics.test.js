import { describe, it, expect, afterEach } from "vitest"
import {
  computeOverrunFields,
  getReworkCount,
  wasEverReviewed,
  getLastReworkFeedback,
  getBlockedAgeDays,
  getProgressForStatus,
  PATTERN_LOOKBACK,
  PATTERN_MIN_SAMPLE,
  PATTERN_THRESHOLD,
  QUALITY_MIN_SAMPLE,
  QUALITY_THRESHOLD
} from "../../../services/taskMetrics.js"
import { freezeTime, restoreTime } from "../../helpers/clock.js"

// First real coverage of the metric helpers, written alongside their extraction from
// taskController.js. Before the extraction none of this was reachable without a
// database, an org fixture and an HTTP call.
//
// Mon–Fri calendar, no holidays — the shape calendarService expects.
const WEEKDAY_SETTINGS = { workingDays: [1, 2, 3, 4, 5], holidays: [] }

const historyOf = (...entries) => ({ history: entries })
const sentBack = (comment) => ({ fromStatus: "In Review", toStatus: "In Progress", comment })
const submitted = () => ({ fromStatus: "In Progress", toStatus: "In Review", comment: "" })

describe("computeOverrunFields", () => {
  it("reports no overrun when no estimate was set", () => {
    // A task with no estimate cannot overrun one. 0% must not read as "on target".
    expect(computeOverrunFields(0, 7200)).toEqual({
      timeVarianceSeconds: 7200,
      overrunPercentage: 0,
      isOverrun: false
    })
  })

  it("treats a missing estimate the same as zero", () => {
    expect(computeOverrunFields(undefined, 3600)).toEqual(computeOverrunFields(0, 3600))
    expect(computeOverrunFields(null, 3600)).toEqual(computeOverrunFields(0, 3600))
  })

  it("is not an overrun when actual exactly equals estimate", () => {
    const result = computeOverrunFields(2, 7200)
    expect(result.timeVarianceSeconds).toBe(0)
    expect(result.overrunPercentage).toBe(0)
    expect(result.isOverrun).toBe(false)
  })

  it("reports the overrun percentage when actual exceeds estimate", () => {
    // 2h estimated, 3h tracked → +1h, +50%
    expect(computeOverrunFields(2, 10800)).toEqual({
      timeVarianceSeconds: 3600,
      overrunPercentage: 50,
      isOverrun: true
    })
  })

  it("reports a negative variance under estimate without flagging an overrun", () => {
    const result = computeOverrunFields(2, 1800)
    expect(result.timeVarianceSeconds).toBe(-5400)
    expect(result.overrunPercentage).toBe(-75)
    expect(result.isOverrun).toBe(false)
  })

  it("is not an overrun when an estimate exists but nothing was tracked", () => {
    expect(computeOverrunFields(2, 0).isOverrun).toBe(false)
  })
})

describe("getReworkCount", () => {
  it("is zero for a task with no history at all", () => {
    expect(getReworkCount({})).toBe(0)
    expect(getReworkCount({ history: [] })).toBe(0)
  })

  it("counts only In Review → In Progress transitions", () => {
    const task = historyOf(
      { fromStatus: "Not Started", toStatus: "In Progress" },
      submitted(),
      sentBack("Missing the summary"),
      { fromStatus: "In Progress", toStatus: "Pending" }
    )
    expect(getReworkCount(task)).toBe(1)
  })

  it("counts every round trip", () => {
    expect(getReworkCount(historyOf(submitted(), sentBack("once"), submitted(), sentBack("twice")))).toBe(2)
  })
})

describe("wasEverReviewed", () => {
  it("is false for work that never entered review", () => {
    // Daily and self-assigned tasks skip review by design — they must not land in the
    // first-pass-approval denominator.
    expect(wasEverReviewed(historyOf({ fromStatus: "In Progress", toStatus: "Completed" }))).toBe(false)
    expect(wasEverReviewed({})).toBe(false)
  })

  it("is true once the task has been submitted for review", () => {
    expect(wasEverReviewed(historyOf(submitted()))).toBe(true)
  })
})

describe("getLastReworkFeedback", () => {
  it("is empty when the task was never sent back", () => {
    expect(getLastReworkFeedback({})).toBe("")
    expect(getLastReworkFeedback(historyOf(submitted()))).toBe("")
  })

  it("returns the most recent feedback, not the first", () => {
    const task = historyOf(submitted(), sentBack("first pass"), submitted(), sentBack("second pass"))
    expect(getLastReworkFeedback(task)).toBe("second pass")
  })

  it("returns empty string when the manager left no comment", () => {
    expect(getLastReworkFeedback(historyOf(sentBack(undefined)))).toBe("")
  })
})

describe("getBlockedAgeDays", () => {
  afterEach(() => restoreTime())

  it("is null when the task is not blocked", () => {
    // null, not 0 — callers must be able to tell "not blocked" from "blocked today".
    expect(getBlockedAgeDays({ isBlocked: false, blockedAt: new Date() }, WEEKDAY_SETTINGS)).toBeNull()
  })

  it("is null when a blocked task has no blockedAt timestamp", () => {
    expect(getBlockedAgeDays({ isBlocked: true, blockedAt: null }, WEEKDAY_SETTINGS)).toBeNull()
  })

  it("counts working days only, skipping the weekend", () => {
    // Blocked Friday, measured the following Monday: Fri, Mon are working days, minus
    // the day it was raised = 1. The weekend must not inflate it.
    freezeTime("2026-03-16T10:00:00")      // Monday
    const blockedFriday = new Date("2026-03-13T10:00:00") // Friday
    expect(getBlockedAgeDays({ isBlocked: true, blockedAt: blockedFriday }, WEEKDAY_SETTINGS)).toBe(1)
  })

  it("is zero on the day the task was blocked", () => {
    freezeTime("2026-03-16T17:00:00")
    expect(
      getBlockedAgeDays({ isBlocked: true, blockedAt: new Date("2026-03-16T09:00:00") }, WEEKDAY_SETTINGS)
    ).toBe(0)
  })

  it("falls back to plain calendar days when no calendar is supplied", () => {
    freezeTime("2026-03-16T10:00:00")
    const twoDaysAgo = new Date("2026-03-14T10:00:00")
    expect(getBlockedAgeDays({ isBlocked: true, blockedAt: twoDaysAgo }, null)).toBeCloseTo(2, 5)
  })

  it("never returns a negative age for a future timestamp", () => {
    freezeTime("2026-03-16T10:00:00")
    const tomorrow = new Date("2026-03-17T10:00:00")
    expect(getBlockedAgeDays({ isBlocked: true, blockedAt: tomorrow }, WEEKDAY_SETTINGS)).toBe(0)
    expect(getBlockedAgeDays({ isBlocked: true, blockedAt: tomorrow }, null)).toBe(0)
  })
})

describe("getProgressForStatus", () => {
  it("maps every workflow status", () => {
    expect(getProgressForStatus("Not Started")).toBe(0)
    expect(getProgressForStatus("In Progress")).toBe(50)
    expect(getProgressForStatus("Pending")).toBe(50)
    expect(getProgressForStatus("In Review")).toBe(90)
    expect(getProgressForStatus("Completed")).toBe(100)
  })

  it("falls back to 0 for anything unrecognised", () => {
    expect(getProgressForStatus("Rejected")).toBe(0)  // a legacy pre-Iteration-6 status
    expect(getProgressForStatus(undefined)).toBe(0)
  })
})

describe("signal thresholds", () => {
  // These constants encode locked product decisions, so a change to one should be a
  // deliberate edit to this test as well, never an incidental tweak.
  it("holds the documented estimation-pattern thresholds", () => {
    expect(PATTERN_LOOKBACK).toBe(5)
    expect(PATTERN_MIN_SAMPLE).toBe(3)
    expect(PATTERN_THRESHOLD).toBe(0.5)
  })

  it("holds the documented quality thresholds", () => {
    expect(QUALITY_MIN_SAMPLE).toBe(3)
    expect(QUALITY_THRESHOLD).toBe(0.5)
  })
})
