import WorkSession from "../models/WorkSession.js"

// Shared work-session helpers for task-side operations (status transitions, task
// edits, task cancellation). Timer events are always computed server-side — client
// timestamps are never trusted (Core Rule 1), and sessions are retained per task,
// never discarded (Locked Logic §2).

/**
 * Elapsed seconds for a work session, accounting for pause/resume events.
 *  - No events: running continuously since `startedAt`.
 *  - Last event is a pause: the session holds its accumulated `totalSeconds`.
 *  - Last event is a resume: accumulated seconds plus time since that resume.
 *
 * This is the single source of truth for the calculation on the task side. The
 * inline variants this replaced (in updateTaskStatus) measured from `startedAt`
 * unconditionally and therefore counted paused time as worked time.
 *
 * @param {object|null} session - A WorkSession document
 * @returns {number} Whole elapsed seconds, never negative
 */
export const calculateSessionElapsedSeconds = (session) => {
  if (!session) return 0

  const events = session.events || []
  if (events.length === 0) {
    const elapsed = (Date.now() - new Date(session.startedAt).getTime()) / 1000
    return Math.max(0, Math.floor(elapsed))
  }

  const lastEvent = events[events.length - 1]
  if (lastEvent.type === "pause") {
    return Math.floor(session.totalSeconds)
  }

  const elapsed = session.totalSeconds + (Date.now() - new Date(lastEvent.timestamp).getTime()) / 1000
  return Math.max(0, Math.floor(elapsed))
}

// Freezes a session's accumulated time and closes it out. Never deletes.
const closeOutSession = async (session, dbSession = undefined) => {
  session.totalSeconds = calculateSessionElapsedSeconds(session)
  session.stoppedAt = new Date()
  await session.save({ session: dbSession })
  return session
}

/**
 * Stops the running session for a specific task, preserving accumulated seconds.
 * Used when a task moves out of "In Progress", is reassigned, or is cancelled.
 *
 * @param {string} taskId
 * @param {string|null} employeeId - Optional; scopes to one employee's session
 * @param {object} [dbSession] - Optional Mongoose transaction session; when passed,
 *   the read and the write both join that transaction instead of committing alone.
 * @returns {Promise<object|null>} The stopped session, or null if none was running
 */
export const stopRunningSessionForTask = async (taskId, employeeId = null, dbSession = undefined) => {
  const filter = { task: taskId, stoppedAt: null }
  if (employeeId) filter.employee = employeeId

  const session = await WorkSession.findOne(filter).session(dbSession)
  if (!session) return null

  return closeOutSession(session, dbSession)
}

/**
 * Stops whichever session an employee currently has running, on any task —
 * enforces "exactly one active timer per employee" (Locked Logic §2) before a new
 * one is started.
 *
 * @param {string} employeeId
 * @returns {Promise<object|null>} The stopped session, or null if none was running
 */
export const stopActiveSessionForEmployee = async (employeeId) => {
  const session = await WorkSession.findOne({ employee: employeeId, stoppedAt: null })
  if (!session) return null

  return closeOutSession(session)
}

/**
 * Stops whatever session an employee has running, then starts a new one for `taskId`.
 * Single source of truth for "start a timer" so both the dedicated timer endpoint
 * (workSessionController.startSession) and the status-transition path
 * (taskController.updateTaskStatus, moving a task to "In Progress") stay in sync.
 *
 * The stop-then-create sequence is two separate writes, so two concurrent calls for the
 * same employee can both pass the "stop the old one" step before either commits their new
 * session. WorkSession's partial unique index on { employee, stoppedAt: null } (Locked
 * Logic §2 — exactly one active timer) makes the database itself reject the second
 * `create`; the loser retries, which by then finds the winner's session and stops it
 * instead, converging to a single active session rather than surfacing a 500 to the user.
 *
 * Returns the sessions it STOPPED along the way, not just the new one. The caller needs
 * them to put those tasks back to "Pending": reading the active session BEFORE calling
 * this is unsafe under concurrency, because a competing request may not have created its
 * session yet, leaving that task stranded as "In Progress" with no timer behind it.
 *
 * @param {string} taskId
 * @param {string} employeeId
 * @returns {Promise<{session: object, stopped: object[]}>}
 */
export const startSessionForTask = async (taskId, employeeId, attempt = 0, stopped = []) => {
  const justStopped = await stopActiveSessionForEmployee(employeeId)
  if (justStopped) stopped.push(justStopped)

  try {
    const session = await WorkSession.create({ task: taskId, employee: employeeId, startedAt: new Date() })
    return { session, stopped }
  } catch (err) {
    if (err.code === 11000 && attempt < 3) {
      return startSessionForTask(taskId, employeeId, attempt + 1, stopped)
    }
    throw err
  }
}
