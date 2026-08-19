import { vi } from "vitest"

// Deterministic time.
//
// Only `Date` is faked — never setTimeout/setInterval/queueMicrotask. Faking those
// would deadlock the MongoDB driver, which uses real timers internally for connection
// and server-selection timeouts. Every calculation under test (elapsed seconds,
// capacity for a day, overdue, blocked age, carry-forward) reads Date.now() or
// `new Date()`, so faking Date alone is both sufficient and safe.

const TO_FAKE = ["Date"]

/** Pin the clock. Pass anything the Date constructor accepts. */
export const freezeTime = (when) => {
  vi.useFakeTimers({ toFake: TO_FAKE })
  vi.setSystemTime(new Date(when))
}

/** Move the pinned clock forward (or back, with a negative value). */
export const advanceTimeBy = (ms) => {
  vi.setSystemTime(new Date(Date.now() + ms))
}

export const advanceTimeByHours = (hours) => advanceTimeBy(hours * 60 * 60 * 1000)
export const advanceTimeByDays = (days) => advanceTimeBy(days * 24 * 60 * 60 * 1000)

export const restoreTime = () => {
  vi.useRealTimers()
}

/** Run `fn` with the clock pinned, restoring real time afterwards even on failure. */
export const withFrozenTime = async (when, fn) => {
  freezeTime(when)
  try {
    return await fn()
  } finally {
    restoreTime()
  }
}

/**
 * The timezone this process is running in. The date-boundary suites are run under a
 * matrix of these in CI (UTC, Asia/Kolkata, America/Los_Angeles) because this app does
 * its day-boundary maths in LOCAL time throughout — calendarService.startOfDay,
 * dailyTaskService's startOfToday, taskScopeService, and every isSameCalendarDay call.
 * A test that passes only in one offset is hiding a bug.
 */
export const timeZone = () => process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone

/** Local start-of-day, matching the convention used across the application. */
export const startOfLocalDay = (when = new Date()) => {
  const d = new Date(when)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
