import { describe, it, expect, afterEach } from "vitest"
import { calculateSessionElapsedSeconds } from "../../../services/taskService.js"
import { calculateSessionTime } from "../../../controllers/workSessionController.js"
import { freezeTime, restoreTime } from "../../helpers/clock.js"

// MIRROR CONTRACT: the elapsed-seconds calculation exists twice.
//
//   services/taskService.js      → calculateSessionElapsedSeconds(session) → number
//   controllers/workSessionController.js → calculateSessionTime(session) → { elapsedSeconds, isRunning }
//
// The first is used by the task-side paths (list rollups, status transitions, the
// progress report, the daily work log's prefill). The second is used by every timer
// endpoint — it is what the running clock in the UI is reconciled against. If they ever
// disagree, a task's tracked time and the timer the employee just watched will report
// different numbers, and neither will look obviously wrong.
//
// They have since been COLLAPSED: calculateSessionTime now delegates the arithmetic to
// calculateSessionElapsedSeconds and adds only the `isRunning` flag. This file is kept
// as the proof that consolidation was behaviour-preserving, and as a guard against the
// duplication creeping back — every fixture below still exercises both entry points.

const NOW = "2026-03-16T12:00:00.000Z"
const at = (offsetMs) => new Date(new Date(NOW).getTime() + offsetMs)
const minutes = (n) => n * 60 * 1000

// Every shape a session can be in, including the awkward ones.
const FIXTURES = {
  "freshly started": { startedAt: at(-minutes(30)), events: [], totalSeconds: 0 },
  "started seconds ago": { startedAt: at(-1500), events: [], totalSeconds: 0 },
  "started this instant": { startedAt: at(0), events: [], totalSeconds: 0 },
  "paused": {
    startedAt: at(-minutes(120)),
    totalSeconds: 600,
    events: [{ type: "pause", timestamp: at(-minutes(110)) }]
  },
  "paused with a fractional total": {
    startedAt: at(-minutes(20)),
    totalSeconds: 42.9,
    events: [{ type: "pause", timestamp: at(-minutes(19)) }]
  },
  "resumed": {
    startedAt: at(-minutes(60)),
    totalSeconds: 600,
    events: [
      { type: "pause", timestamp: at(-minutes(50)) },
      { type: "resume", timestamp: at(-minutes(5)) }
    ]
  },
  "resumed after several cycles": {
    startedAt: at(-minutes(100)),
    totalSeconds: 1200,
    events: [
      { type: "pause", timestamp: at(-minutes(90)) },
      { type: "resume", timestamp: at(-minutes(60)) },
      { type: "pause", timestamp: at(-minutes(50)) },
      { type: "resume", timestamp: at(-minutes(2)) }
    ]
  },
  "started in the future (clock skew)": { startedAt: at(minutes(30)), events: [], totalSeconds: 0 },
  "resumed in the future (clock skew)": {
    startedAt: at(-minutes(60)),
    totalSeconds: 0,
    events: [
      { type: "pause", timestamp: at(-minutes(50)) },
      { type: "resume", timestamp: at(minutes(30)) }
    ]
  },
  "carrying ISO date strings rather than Dates": {
    startedAt: at(-minutes(10)).toISOString(),
    totalSeconds: 0,
    events: []
  }
}

describe("timer math agreement", () => {
  afterEach(() => restoreTime())

  for (const [name, session] of Object.entries(FIXTURES)) {
    it(`agrees on a session ${name}`, () => {
      freezeTime(NOW)
      expect(calculateSessionTime(session).elapsedSeconds).toBe(calculateSessionElapsedSeconds(session))
    })
  }

  it("agrees that a missing session has no elapsed time", () => {
    freezeTime(NOW)
    expect(calculateSessionTime(null).elapsedSeconds).toBe(calculateSessionElapsedSeconds(null))
    expect(calculateSessionTime(null).isRunning).toBe(false)
  })

  it("reports isRunning consistently with which branch the arithmetic took", () => {
    freezeTime(NOW)
    expect(calculateSessionTime(FIXTURES["freshly started"]).isRunning).toBe(true)
    expect(calculateSessionTime(FIXTURES["paused"]).isRunning).toBe(false)
    expect(calculateSessionTime(FIXTURES["resumed"]).isRunning).toBe(true)
  })

  it("agrees on a session document with no events array", () => {
    // This is the divergence the contract caught before the consolidation: the timer
    // controller read `session.events` directly and threw on a document without one,
    // where the service guards with `events || []`. Unreachable while every read is a
    // full Mongoose document — but live the moment a timer endpoint uses `.lean()` or a
    // projection, which the payload work makes likely. The merged implementation keeps
    // the safe behaviour.
    freezeTime(NOW)
    const noEvents = { startedAt: at(-minutes(2)), totalSeconds: 0 }

    expect(calculateSessionElapsedSeconds(noEvents)).toBe(120)
    expect(calculateSessionTime(noEvents)).toEqual({ elapsedSeconds: 120, isRunning: true })
  })
})
