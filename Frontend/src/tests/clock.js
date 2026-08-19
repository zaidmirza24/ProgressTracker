import { vi } from "vitest"

// Deterministic time for the frontend suite. Mirrors Backend/tests/helpers/clock.js so
// both sides freeze time the same way.
//
// Only `Date` is faked. TimerContext ticks on a real 1s interval and React's scheduler
// uses timers internally — faking those would stall renders and make every async
// assertion hang rather than fail.

const TO_FAKE = ["Date"]

export const freezeTime = (when) => {
  vi.useFakeTimers({ toFake: TO_FAKE })
  vi.setSystemTime(new Date(when))
}

export const advanceTimeBy = (ms) => {
  vi.setSystemTime(new Date(Date.now() + ms))
}

export const advanceTimeByDays = (days) => advanceTimeBy(days * 24 * 60 * 60 * 1000)

export const restoreTime = () => {
  vi.useRealTimers()
}
