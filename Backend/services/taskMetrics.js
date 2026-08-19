import { workingDaysBetween } from "./calendarService.js"

// Pure task-metric derivations, extracted verbatim from taskController.js.
//
// These were private module-level helpers inside a 1200-line controller, which made
// them unreachable from a unit test — the only way to exercise the estimation-pattern
// thresholds or the overrun arithmetic was to stand up a database, seed an org and
// call an HTTP endpoint. They are pure functions of their arguments, so they belong in
// a service where they can be tested directly.
//
// Every function below is unchanged in behaviour: same inputs, same outputs, same
// rounding, same edge cases. The only difference is where they live.
//
// Consumers: taskController.js (list, single-task, report paths). Anything reading
// these numbers must import from here rather than reimplementing them — the frontend
// mirrors of these rules (Frontend/src/lib/taskFormatters.js, taskConstants.js) are
// asserted against this module by the mirror-contract tests.

// ─── Estimated vs Actual (Locked Logic §5) ───────────────────────────────────

/**
 * Time variance and overrun for one task.
 *
 * `isOverrun` is deliberately false when no estimate is set: a task with no estimate
 * cannot overrun one, and reporting 0% there would read as "on target" rather than
 * "not measured".
 */
export const computeOverrunFields = (estimatedHours, totalTrackedSeconds) => {
  const estimatedSeconds = (estimatedHours || 0) * 3600
  const timeVarianceSeconds = totalTrackedSeconds - estimatedSeconds
  const overrunPercentage = estimatedSeconds > 0
    ? Math.round((timeVarianceSeconds / estimatedSeconds) * 100)
    : 0
  const isOverrun = estimatedSeconds > 0 && timeVarianceSeconds > 0
  return { timeVarianceSeconds, overrunPercentage, isOverrun }
}

// ─── Estimation pattern (Locked Logic §10) ───────────────────────────────────
// A majority of the last few completed+estimated tasks overrunning is a signal worth
// surfacing, never punitive. Small samples are deliberately not flagged.

export const PATTERN_LOOKBACK = 5
export const PATTERN_MIN_SAMPLE = 3
export const PATTERN_THRESHOLD = 0.5

// ─── Quality / rework (Locked Logic §9, §11) ─────────────────────────────────
// Derived entirely from task.history — no new state is stored, so these numbers are
// available retroactively for every task already in the database.
//
// Crucially, no role check is needed: employees have NO "In Review" transition in
// WORKFLOW_RULES at all, so an "In Review" -> "In Progress" entry can only have been a
// manager sending work back. That makes rework unambiguously identifiable from history.

export const QUALITY_MIN_SAMPLE = 3
export const QUALITY_THRESHOLD = 0.5

export const getReworkCount = (task) =>
  (task.history || []).filter(h => h.fromStatus === "In Review" && h.toStatus === "In Progress").length

// Only review-gated work can have a first-pass rate. Daily and self-assigned tasks skip
// review entirely by design, so including them would drown the denominator and report a
// permanent ~100% for everyone.
export const wasEverReviewed = (task) =>
  (task.history || []).some(h => h.toStatus === "In Review")

// The feedback a manager gave when they last sent it back — the actionable part.
export const getLastReworkFeedback = (task) => {
  const entry = [...(task.history || [])].reverse()
    .find(h => h.fromStatus === "In Review" && h.toStatus === "In Progress")
  return entry?.comment || ""
}

// ─── Backlog age (Locked Logic §8) ───────────────────────────────────────────

/**
 * How long a task has been BLOCKED, in working days. This is the metric Locked Logic §8
 * actually asked for ("track pending backlog, including how long each task has sat
 * pending") — the old pending-age metric measured time since the timer was paused,
 * which is mostly evenings and weekends, not waiting.
 *
 * Returns null for a task that is not blocked, so callers can distinguish "not blocked"
 * from "blocked for zero days".
 */
export const getBlockedAgeDays = (task, settings) => {
  if (!task.isBlocked || !task.blockedAt) return null
  const since = new Date(task.blockedAt)
  if (!settings) return Math.max(0, (Date.now() - since.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, workingDaysBetween(since, new Date(), settings) - 1)
}

// ─── Progress mapping ────────────────────────────────────────────────────────
// Status → default progress %. Mirrored on the client by PROGRESS_FOR_STATUS in
// Frontend/src/lib/taskConstants.js for optimistic updates; the server value always
// wins, and the mirror-contract test asserts the two agree.
export const getProgressForStatus = (status) => {
  switch (status) {
    case "Not Started": return 0
    case "In Progress": return 50
    case "Pending": return 50
    case "In Review": return 90
    case "Completed": return 100
    default: return 0
  }
}
