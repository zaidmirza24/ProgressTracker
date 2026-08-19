import { describe, it, expect, afterEach } from "vitest"
import { calculateSessionElapsedSeconds } from "../../../services/taskService.js"
import { freezeTime, advanceTimeBy, restoreTime } from "../../helpers/clock.js"

// Timer elapsed-seconds arithmetic (Core Rule 1 — always computed server-side).
//
// Everything downstream is derived from this number: every tracked hour, every
// estimated-vs-actual variance, every overrun badge, every planned/actual utilisation
// percentage, and the hours pre-filled into a daily work log. An error here is
// invisible until someone checks their timesheet.
//
// Pure arithmetic over a session document, so no database is needed — the function
// only ever reads `startedAt`, `events` and `totalSeconds`.

const NOW = "2026-03-16T12:00:00.000Z"
const at = (offsetMs) => new Date(new Date(NOW).getTime() + offsetMs)
const minutes = (n) => n * 60 * 1000

// A session as it exists in the database: created running, with no events yet.
const runningSince = (msAgo) => ({ startedAt: at(-msAgo), events: [], totalSeconds: 0 })

describe("calculateSessionElapsedSeconds", () => {
  afterEach(() => restoreTime())

  describe("a session with no pause/resume events", () => {
    it("counts continuously from startedAt", () => {
      freezeTime(NOW)
      expect(calculateSessionElapsedSeconds(runningSince(minutes(30)))).toBe(1800)
    })

    it("keeps accruing as time passes", () => {
      freezeTime(NOW)
      const session = runningSince(minutes(5))
      expect(calculateSessionElapsedSeconds(session)).toBe(300)

      advanceTimeBy(minutes(10))
      expect(calculateSessionElapsedSeconds(session)).toBe(900)
    })

    it("floors partial seconds rather than rounding up", () => {
      freezeTime(NOW)
      expect(calculateSessionElapsedSeconds(runningSince(1999))).toBe(1)
      expect(calculateSessionElapsedSeconds(runningSince(999))).toBe(0)
    })

    it("ignores a totalSeconds value it has no events to justify", () => {
      // Documents real behaviour. Unreachable in practice — the timer only writes
      // totalSeconds at the same moment it appends a pause event — but worth pinning
      // so a future change to session creation cannot silently lose time here.
      freezeTime(NOW)
      const odd = { startedAt: at(-minutes(1)), events: [], totalSeconds: 9999 }
      expect(calculateSessionElapsedSeconds(odd)).toBe(60)
    })
  })

  describe("a paused session", () => {
    it("freezes at the accumulated total and does not keep counting", () => {
      // This is the whole reason the function exists. The inline versions it replaced
      // measured from startedAt unconditionally, so a task paused overnight accrued
      // the entire night as worked time.
      freezeTime(NOW)
      const paused = {
        startedAt: at(-minutes(120)),
        totalSeconds: 600,
        events: [{ type: "pause", timestamp: at(-minutes(110)) }]
      }
      expect(calculateSessionElapsedSeconds(paused)).toBe(600)

      advanceTimeBy(minutes(480)) // eight hours later
      expect(calculateSessionElapsedSeconds(paused)).toBe(600)
    })

    it("floors a fractional accumulated total", () => {
      freezeTime(NOW)
      const paused = {
        startedAt: at(-minutes(10)),
        totalSeconds: 42.9,
        events: [{ type: "pause", timestamp: at(-minutes(9)) }]
      }
      expect(calculateSessionElapsedSeconds(paused)).toBe(42)
    })
  })

  describe("a resumed session", () => {
    it("adds time since the resume to the accumulated total", () => {
      freezeTime(NOW)
      const resumed = {
        startedAt: at(-minutes(60)),
        totalSeconds: 600,                                    // 10 min before pausing
        events: [
          { type: "pause", timestamp: at(-minutes(50)) },
          { type: "resume", timestamp: at(-minutes(5)) }       // running again for 5 min
        ]
      }
      // 10 min banked + 5 min since resume = 15 min. The 45 minutes spent paused are
      // correctly excluded.
      expect(calculateSessionElapsedSeconds(resumed)).toBe(900)
    })

    it("handles several pause/resume cycles, counting only running time", () => {
      freezeTime(NOW)
      const session = {
        startedAt: at(-minutes(100)),
        totalSeconds: 1200, // 20 min banked across two earlier working stretches
        events: [
          { type: "pause", timestamp: at(-minutes(90)) },
          { type: "resume", timestamp: at(-minutes(60)) },
          { type: "pause", timestamp: at(-minutes(50)) },
          { type: "resume", timestamp: at(-minutes(2)) }
        ]
      }
      expect(calculateSessionElapsedSeconds(session)).toBe(1200 + 120)
    })

    it("continues accruing while running", () => {
      freezeTime(NOW)
      const resumed = {
        startedAt: at(-minutes(60)),
        totalSeconds: 300,
        events: [
          { type: "pause", timestamp: at(-minutes(55)) },
          { type: "resume", timestamp: at(-minutes(1)) }
        ]
      }
      expect(calculateSessionElapsedSeconds(resumed)).toBe(360)

      advanceTimeBy(minutes(2))
      expect(calculateSessionElapsedSeconds(resumed)).toBe(480)
    })
  })

  describe("defensive cases", () => {
    it("returns 0 for a missing session", () => {
      expect(calculateSessionElapsedSeconds(null)).toBe(0)
      expect(calculateSessionElapsedSeconds(undefined)).toBe(0)
    })

    it("tolerates a session document with no events array", () => {
      // A `.lean()` or projected read can omit it.
      freezeTime(NOW)
      expect(calculateSessionElapsedSeconds({ startedAt: at(-minutes(2)), totalSeconds: 0 })).toBe(120)
    })

    it("never returns a negative elapsed time for a future startedAt", () => {
      // Clock skew between app servers, or a corrected system clock, must not produce
      // negative hours that would silently subtract from someone's tracked time.
      freezeTime(NOW)
      expect(calculateSessionElapsedSeconds(runningSince(-minutes(30)))).toBe(0)
    })

    it("never returns a negative elapsed time for a future resume timestamp", () => {
      freezeTime(NOW)
      const session = {
        startedAt: at(-minutes(60)),
        totalSeconds: 0,
        events: [
          { type: "pause", timestamp: at(-minutes(50)) },
          { type: "resume", timestamp: at(minutes(30)) }
        ]
      }
      expect(calculateSessionElapsedSeconds(session)).toBe(0)
    })

    it("accepts date strings as well as Date objects", () => {
      // Sessions arriving as plain JSON (lean reads, cached documents) carry ISO
      // strings rather than Dates.
      freezeTime(NOW)
      const session = {
        startedAt: at(-minutes(10)).toISOString(),
        totalSeconds: 0,
        events: []
      }
      expect(calculateSessionElapsedSeconds(session)).toBe(600)
    })
  })
})
