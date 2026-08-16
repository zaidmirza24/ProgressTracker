export const getLocalDateString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export const formatTrackedTime = (seconds) => {
  if (!seconds) return "0m"
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (hrs > 0) {
    return `${hrs}h ${mins}m`
  }
  return `${mins}m`
}

// Live-running timer display (HH:MM:SS / MM:SS), distinct from formatTrackedTime's "Xh Ym" summary format.
export const formatTime = (totalSecs) => {
  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)
  const secs = Math.floor(totalSecs % 60)
  const pad = (num) => String(num).padStart(2, "0")
  if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
  return `${pad(mins)}:${pad(secs)}`
}

// Decimal-hours display used by SuperAdmin's reports (e.g. "3.5h") — distinct format from formatTrackedTime.
export const formatHours = (seconds) => {
  if (!seconds) return "0.0h"
  return (seconds / 3600).toFixed(1) + "h"
}

// Overrun badge text (e.g. "+34% over est."), or null when the task isn't overrun.
export const formatOverrun = (task) => {
  if (!task?.isOverrun) return null
  return `+${task.overrunPercentage}% over est.`
}

// "Reworked x2" for a task a manager has sent back, or null. Reviewing a task that has
// already bounced twice is a materially different decision from reviewing a fresh one.
export const formatRework = (task) => {
  const n = task?.reworkCount || 0
  return n > 0 ? `Reworked ×${n}` : null
}

// First-pass approval only means something for review-gated work. Employees on mostly
// daily tasks have no reviewed tasks at all and must read as "—", never 0% or 100% (§41).
export const formatQualityRate = (pct) =>
  (pct === null || pct === undefined) ? "—" : `${pct}%`

// Short label for a blocked task's badge, or null when it isn't blocked.
export const formatBlocked = (task) => {
  if (!task?.isBlocked) return null
  if (!task.blockedAt) return "Blocked"
  const days = Math.floor((Date.now() - new Date(task.blockedAt).getTime()) / (1000 * 60 * 60 * 24))
  return days >= 1 ? `Blocked ${days}d` : "Blocked"
}

// "Carried from Aug 12" for a carried-forward daily task. Falls back to `createdAt`
// for tasks carried forward before `originalDailyDate` existed (never backfilled —
// old carry-forwards had already lost their true origin date at that point).
export const formatCarryForwardDate = (task) => {
  if (!task?.isCarryForward) return null
  const original = task.originalDailyDate || task.createdAt
  if (!original) return null
  return `Carried from ${new Date(original).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
}

export const getInitials = (name, fallback = "US") => {
  return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : fallback
}

// Utilisation is null when there's no capacity that day (weekend, holiday, leave) —
// nobody is "0% utilised" on a Sunday, the question simply doesn't apply (§41).
export const formatUtilization = (pct) =>
  (pct === null || pct === undefined) ? "—" : `${pct}%`

// Plain-English reason capacity is zero/reduced today, from the report's
// capacityReasonToday field.
export const CAPACITY_REASON_TEXT = {
  weekend: "a non-working day",
  holiday: "a holiday",
  leave: "on leave",
  half_day: "a half day",
  no_hours_configured: "no working hours configured"
}

const describeUtilization = (pct) => {
  if (pct >= 100) return "over capacity"
  if (pct >= 85) return "almost at full capacity"
  if (pct >= 50) return "at moderate capacity"
  if (pct >= 15) return "running low"
  if (pct > 0) return "very low"
  return "essentially idle"
}

const describeBacklogAge = (days) => {
  if (days < 1) return "very recent"
  if (days < 3) return "recent"
  if (days < 7) return "starting to age"
  return "aging significantly"
}

// Turns a getProgressReport employeeReport row (Iterations 7-10's signals) into a
// plain-English narrative — a `headline` (the flags, if any, else the task-count
// sentence) for a collapsed row preview, and a `paragraph` (every signal, as flowing
// sentences) for the expanded view. Pronouns are avoided (no gender data) in favor of
// "They"/"Their".
export const buildEmployeeSignalSummary = (r) => {
  const firstName = r.name?.split(" ")[0] || "This employee"
  const trackedHours = (r.totalTrackedSeconds / 3600).toFixed(1)

  const taskSentence = `${firstName} has ${r.total} task${r.total === 1 ? "" : "s"}, ${r.completed} completed and ${r.inProgress} in progress.`
  const timeSentence = `They have tracked ${trackedHours} hours.`

  // A day with no capacity is explained rather than reported as idleness.
  const capacitySentence = (r.capacityHoursToday === 0 || r.plannedUtilizationPct === null)
    ? `Today is ${CAPACITY_REASON_TEXT[r.capacityReasonToday] || "not a working day"} for them, so utilisation doesn't apply.`
    : (r.plannedUtilizationPct > 0 || r.actualUtilizationPct > 0)
      ? `Their planned workload is ${describeUtilization(r.plannedUtilizationPct)} (${r.plannedUtilizationPct}%), but actual utilization is currently ${describeUtilization(r.actualUtilizationPct)} (${r.actualUtilizationPct}%).`
      : "No workload is planned or tracked for today."

  const completionSentence = `They have completed ${r.overallCompletionRate}% of the overall workload, with ${r.dailyCompletionRate}% completion for the daily measure and ${r.assignedCompletionRate}% for assigned tasks.`

  // Paused (timer off) and blocked (can't proceed) are reported separately — only the
  // second is a backlog worth ageing.
  const blockedCount = r.blockedCount ?? 0
  const pausedCount = r.pausedCount ?? r.pending ?? 0
  const blockedSentence = blockedCount > 0
    ? `${blockedCount} task${blockedCount === 1 ? " is" : "s are"} blocked, ${describeBacklogAge(r.blockedBacklogAvgAgeDays)} (${r.blockedBacklogAvgAgeDays} working days average) — worth unblocking.`
    : "Nothing is blocked."
  const pendingSentence = pausedCount > 0
    ? `${pausedCount} task${pausedCount === 1 ? " is" : "s are"} paused, ${r.overdue > 0 ? `and ${r.overdue} ${r.overdue === 1 ? "is" : "are"} overdue.` : "and nothing is overdue."} ${blockedSentence}`
    : (r.overdue > 0
      ? `Nothing is paused, but ${r.overdue} task${r.overdue === 1 ? " is" : "s are"} overdue. ${blockedSentence}`
      : `Nothing is paused and nothing is overdue. ${blockedSentence}`)

  const patternSentence = r.recentEstimatedTasks?.length > 0
    ? `Their average resolution time is ${r.avgResolutionDays} days, while recent work is running about ${Math.round((r.recentOverrunProportion || 0) * 100)}% over estimate.`
    : `Their average resolution time is ${r.avgResolutionDays} days; there isn't yet enough completed, estimated work to gauge an overrun pattern.`

  // Quality reads as an observation, never a verdict — rework points at unclear
  // requirements as often as at the work itself.
  const qualitySentence = r.reviewedTaskCount > 0
    ? `Of ${r.reviewedTaskCount} task${r.reviewedTaskCount === 1 ? "" : "s"} that went through review, ${r.firstPassApprovalRate}% were approved first time.`
    : "They haven't completed any review-gated work yet, so there's no first-pass rate to report."

  const paragraph = [taskSentence, timeSentence, capacitySentence, completionSentence, pendingSentence, qualitySentence, patternSentence].join(" ")

  const hasWarning = r.isCapacityOverrunToday || r.overdue > 0 || r.hasOverrunPattern || (r.blockedCount ?? 0) > 0
  const headline = (r.blockedCount ?? 0) > 0
    ? `${r.blockedCount} task${r.blockedCount === 1 ? " is" : "s are"} blocked.`
    : r.isCapacityOverrunToday
    ? `Over capacity today (${r.actualUtilizationPct}% actual vs ${r.plannedUtilizationPct}% planned).`
    : r.hasOverrunPattern
      ? `Recent work is trending over estimate (${Math.round((r.recentOverrunProportion || 0) * 100)}% of the last ${r.recentEstimatedTasks.length} tasks).`
      : r.overdue > 0
        ? `${r.overdue} task${r.overdue === 1 ? "" : "s"} overdue.`
        : taskSentence

  return { headline, paragraph, hasWarning }
}
