import WorkSession from "../../models/WorkSession.js"

const idOf = (doc) => doc?._id ?? doc

/**
 * Create a persisted work session.
 *
 * Note that a session with `stoppedAt: null` occupies the employee's single
 * active-timer slot, which the partial unique index on {employee, stoppedAt: null}
 * enforces at the database level — creating two for the same employee will (correctly)
 * throw a duplicate-key error.
 */
export const makeSession = async (overrides = {}) => {
  const task = idOf(overrides.task)
  const employee = idOf(overrides.employee)
  if (!task || !employee) throw new Error("makeSession requires task and employee")

  return WorkSession.create({
    task,
    employee,
    startedAt: overrides.startedAt ?? new Date(),
    events: overrides.events ?? [],
    stoppedAt: overrides.stoppedAt ?? null,
    totalSeconds: overrides.totalSeconds ?? 0
  })
}

/** A finished session holding a known amount of tracked time. */
export const makeStoppedSession = ({ task, employee, seconds, startedAt = new Date() }) =>
  makeSession({
    task,
    employee,
    startedAt,
    stoppedAt: new Date(startedAt.getTime() + seconds * 1000),
    totalSeconds: seconds
  })

/** A session currently running: no events, ticking since `startedAt`. */
export const makeRunningSession = ({ task, employee, startedAt = new Date() }) =>
  makeSession({ task, employee, startedAt })

/**
 * A session that is open but paused — the state the timer controller leaves behind on
 * pause. `totalSeconds` is frozen and the last event is a pause, so elapsed time must
 * NOT keep growing. This is the shape the two elapsed-seconds implementations disagree
 * most easily about.
 */
export const makePausedSession = ({ task, employee, seconds, startedAt = new Date() }) =>
  makeSession({
    task,
    employee,
    startedAt,
    totalSeconds: seconds,
    events: [{ type: "pause", timestamp: new Date(startedAt.getTime() + seconds * 1000) }]
  })

/** A session resumed after a pause: accumulated `seconds`, then running again since `resumedAt`. */
export const makeResumedSession = ({ task, employee, seconds, startedAt = new Date(), resumedAt = new Date() }) =>
  makeSession({
    task,
    employee,
    startedAt,
    totalSeconds: seconds,
    events: [
      { type: "pause", timestamp: new Date(startedAt.getTime() + seconds * 1000) },
      { type: "resume", timestamp: resumedAt }
    ]
  })
