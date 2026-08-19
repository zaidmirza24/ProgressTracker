import { describe, it, expect, afterEach } from "vitest"
import {
  getLocalDateString,
  formatTrackedTime,
  formatTime,
  formatHours,
  formatOverrun,
  formatRework,
  formatQualityRate,
  formatBlocked,
  formatCarryForwardDate,
  getInitials,
  formatUtilization,
  buildEmployeeSignalSummary
} from "./taskFormatters"
import { freezeTime, restoreTime } from "../tests/clock"

// Every number a user reads passes through one of these. The recurring theme is the
// distinction between "zero" and "not applicable" (Standards §41): nobody is 0%
// utilised on a Sunday, and an employee with no review-gated work does not have a 0%
// first-pass approval rate — in both cases the question simply does not apply.

const NOW = "2026-03-16T14:30:00" // local — Monday 16 March 2026

describe("formatTrackedTime", () => {
  it("shows minutes under an hour", () => {
    expect(formatTrackedTime(60)).toBe("1m")
    expect(formatTrackedTime(1800)).toBe("30m")
  })

  it("shows hours and minutes past an hour", () => {
    expect(formatTrackedTime(3661)).toBe("1h 1m")
    expect(formatTrackedTime(7200)).toBe("2h 0m")
  })

  it("shows 0m for no tracked time", () => {
    expect(formatTrackedTime(0)).toBe("0m")
    expect(formatTrackedTime(undefined)).toBe("0m")
    expect(formatTrackedTime(null)).toBe("0m")
  })

  it("rounds partial minutes down rather than up", () => {
    // 59 seconds of work is not "1m".
    expect(formatTrackedTime(59)).toBe("0m")
    expect(formatTrackedTime(119)).toBe("1m")
  })
})

describe("formatTime — the live clock", () => {
  it("uses MM:SS under an hour", () => {
    expect(formatTime(0)).toBe("00:00")
    expect(formatTime(65)).toBe("01:05")
    expect(formatTime(3599)).toBe("59:59")
  })

  it("switches to HH:MM:SS at an hour", () => {
    expect(formatTime(3600)).toBe("01:00:00")
    expect(formatTime(3661)).toBe("01:01:01")
    expect(formatTime(36000)).toBe("10:00:00")
  })
})

describe("formatHours", () => {
  it("shows one decimal place", () => {
    expect(formatHours(3600)).toBe("1.0h")
    expect(formatHours(5400)).toBe("1.5h")
  })

  it("shows 0.0h for nothing tracked", () => {
    expect(formatHours(0)).toBe("0.0h")
    expect(formatHours(undefined)).toBe("0.0h")
  })
})

describe("formatOverrun", () => {
  it("is null when the task is not overrunning", () => {
    // Absence of a badge, not a badge reading "0%".
    expect(formatOverrun({ isOverrun: false, overrunPercentage: 0 })).toBeNull()
    expect(formatOverrun({})).toBeNull()
    expect(formatOverrun(null)).toBeNull()
  })

  it("reads as a percentage over estimate when it is", () => {
    expect(formatOverrun({ isOverrun: true, overrunPercentage: 34 })).toBe("+34% over est.")
  })
})

describe("formatRework", () => {
  it("is null for work that was never sent back", () => {
    expect(formatRework({ reworkCount: 0 })).toBeNull()
    expect(formatRework({})).toBeNull()
    expect(formatRework(null)).toBeNull()
  })

  it("counts the round trips", () => {
    // Reviewing a task that has already bounced twice is a materially different
    // decision from reviewing a fresh one.
    expect(formatRework({ reworkCount: 1 })).toBe("Reworked ×1")
    expect(formatRework({ reworkCount: 3 })).toBe("Reworked ×3")
  })
})

describe("formatQualityRate", () => {
  it("shows a dash when there is no reviewed work to rate", () => {
    expect(formatQualityRate(null)).toBe("—")
    expect(formatQualityRate(undefined)).toBe("—")
  })

  it("distinguishes a genuine 0% from not applicable", () => {
    expect(formatQualityRate(0)).toBe("0%")
    expect(formatQualityRate(100)).toBe("100%")
  })
})

describe("formatUtilization", () => {
  it("shows a dash when capacity does not apply that day", () => {
    expect(formatUtilization(null)).toBe("—")
    expect(formatUtilization(undefined)).toBe("—")
  })

  it("distinguishes a genuine 0% from not applicable", () => {
    expect(formatUtilization(0)).toBe("0%")
    expect(formatUtilization(96)).toBe("96%")
  })
})

describe("formatBlocked", () => {
  afterEach(() => restoreTime())

  it("is null when the task is not blocked", () => {
    expect(formatBlocked({ isBlocked: false })).toBeNull()
    expect(formatBlocked(null)).toBeNull()
  })

  it("reads plainly when blocked today or with no timestamp", () => {
    freezeTime(NOW)
    expect(formatBlocked({ isBlocked: true, blockedAt: null })).toBe("Blocked")
    expect(formatBlocked({ isBlocked: true, blockedAt: new Date(2026, 2, 16, 9) })).toBe("Blocked")
  })

  it("shows whole days once it has been blocked for at least one", () => {
    freezeTime(NOW)
    expect(formatBlocked({ isBlocked: true, blockedAt: new Date(2026, 2, 13, 14) })).toBe("Blocked 3d")
  })
})

describe("formatCarryForwardDate", () => {
  it("is null for a task that was not carried forward", () => {
    expect(formatCarryForwardDate({ isCarryForward: false })).toBeNull()
    expect(formatCarryForwardDate(null)).toBeNull()
  })

  it("names the day the task originally came from", () => {
    expect(formatCarryForwardDate({
      isCarryForward: true,
      originalDailyDate: new Date(2026, 2, 12)
    })).toBe("Carried from Mar 12")
  })

  it("falls back to createdAt for tasks carried forward before originalDailyDate existed", () => {
    // Never backfilled — those tasks had already lost their true origin date.
    expect(formatCarryForwardDate({
      isCarryForward: true,
      createdAt: new Date(2026, 1, 28)
    })).toBe("Carried from Feb 28")
  })

  it("is null when neither date is available", () => {
    expect(formatCarryForwardDate({ isCarryForward: true })).toBeNull()
  })
})

describe("getInitials", () => {
  it("takes the first letter of each name part", () => {
    expect(getInitials("Ana Employee")).toBe("AE")
    expect(getInitials("mia manager")).toBe("MM")
  })

  it("caps at two letters", () => {
    expect(getInitials("Ana Maria Del Rio")).toBe("AM")
  })

  it("handles a single name", () => {
    expect(getInitials("Prince")).toBe("P")
  })

  it("falls back when there is no name", () => {
    expect(getInitials(null)).toBe("US")
    expect(getInitials("", "??")).toBe("??")
  })
})

describe("getLocalDateString", () => {
  afterEach(() => restoreTime())

  it("formats today as YYYY-MM-DD in local time", () => {
    // Deliberately local, not ISO/UTC: used for date inputs, where a UTC conversion
    // would show yesterday for anyone west of Greenwich.
    freezeTime("2026-03-06T23:30:00")
    expect(getLocalDateString()).toBe("2026-03-06")
  })

  it("zero-pads single-digit months and days", () => {
    freezeTime("2026-01-05T10:00:00")
    expect(getLocalDateString()).toBe("2026-01-05")
  })
})

describe("buildEmployeeSignalSummary", () => {
  // Asserting WHICH BRANCH was chosen and which numbers were interpolated — never the
  // exact sentence. Pinning prose would make every copy tweak a failing build.
  const baseReport = {
    name: "Ana Employee",
    total: 12, completed: 4, inProgress: 1, overdue: 0,
    totalTrackedSeconds: 3600 * 9,
    capacityHoursToday: 7, capacityReasonToday: null,
    plannedUtilizationPct: 96, actualUtilizationPct: 3,
    isCapacityOverrunToday: false,
    overallCompletionRate: 33, dailyCompletionRate: 50, assignedCompletionRate: 25,
    pausedCount: 0, blockedCount: 0, blockedBacklogAvgAgeDays: 0,
    reviewedTaskCount: 0, firstPassApprovalRate: null,
    avgResolutionDays: 2.4, recentEstimatedTasks: [], recentOverrunProportion: 0,
    hasOverrunPattern: false
  }

  it("leads with the person's first name and their task counts when nothing is wrong", () => {
    const { headline, paragraph, hasWarning } = buildEmployeeSignalSummary(baseReport)
    expect(hasWarning).toBe(false)
    expect(headline).toContain("Ana")
    expect(headline).toContain("12")
    expect(paragraph).toContain("9.0 hours")
  })

  it("explains a zero-capacity day instead of reporting idleness", () => {
    // "0% utilised" on a public holiday is misleading, not informative.
    const { paragraph } = buildEmployeeSignalSummary({
      ...baseReport,
      capacityHoursToday: 0, capacityReasonToday: "holiday",
      plannedUtilizationPct: null, actualUtilizationPct: null
    })
    expect(paragraph).toContain("a holiday")
    expect(paragraph).toContain("utilisation doesn't apply")
  })

  it("leads with blocked work above every other signal", () => {
    const { headline, hasWarning } = buildEmployeeSignalSummary({
      ...baseReport, blockedCount: 2, blockedBacklogAvgAgeDays: 4, overdue: 3, hasOverrunPattern: true
    })
    expect(hasWarning).toBe(true)
    expect(headline).toContain("blocked")
  })

  it("leads with capacity overrun when nothing is blocked", () => {
    const { headline } = buildEmployeeSignalSummary({
      ...baseReport, isCapacityOverrunToday: true, actualUtilizationPct: 130
    })
    expect(headline).toContain("Over capacity")
  })

  it("leads with an estimation pattern when that is the only flag", () => {
    const { headline } = buildEmployeeSignalSummary({
      ...baseReport,
      hasOverrunPattern: true, recentOverrunProportion: 0.8,
      recentEstimatedTasks: [{}, {}, {}, {}, {}]
    })
    expect(headline).toContain("over estimate")
    expect(headline).toContain("80%")
  })

  it("leads with overdue work when that is the only flag", () => {
    const { headline, hasWarning } = buildEmployeeSignalSummary({ ...baseReport, overdue: 2 })
    expect(hasWarning).toBe(true)
    expect(headline).toContain("2 tasks overdue")
  })

  it("says there is no first-pass rate rather than implying a bad one", () => {
    const { paragraph } = buildEmployeeSignalSummary(baseReport)
    expect(paragraph).toContain("no first-pass rate")
  })

  it("reports a first-pass rate once review-gated work exists", () => {
    const { paragraph } = buildEmployeeSignalSummary({
      ...baseReport, reviewedTaskCount: 4, firstPassApprovalRate: 75
    })
    expect(paragraph).toContain("75%")
    expect(paragraph).toContain("4 tasks")
  })

  it("separates paused from blocked work", () => {
    // Paused means the timer is off; blocked means it cannot proceed. Only the second
    // is a backlog worth ageing.
    const { paragraph } = buildEmployeeSignalSummary({ ...baseReport, pausedCount: 3, blockedCount: 0 })
    expect(paragraph).toContain("3 tasks are paused")
    expect(paragraph).toContain("Nothing is blocked")
  })

  it("handles a singular task without mangling the grammar", () => {
    const { paragraph } = buildEmployeeSignalSummary({
      ...baseReport, total: 1, pausedCount: 1, overdue: 1
    })
    expect(paragraph).toContain("1 task,")
    expect(paragraph).toContain("1 task is paused")
  })

  it("copes with a report row for someone with no name", () => {
    const { headline } = buildEmployeeSignalSummary({ ...baseReport, name: undefined })
    expect(headline).toContain("This employee")
  })
})
