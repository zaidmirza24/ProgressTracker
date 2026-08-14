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

export const getInitials = (name, fallback = "US") => {
  return name ? name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : fallback
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

  const capacitySentence = (r.plannedUtilizationPct > 0 || r.actualUtilizationPct > 0)
    ? `Their planned workload is ${describeUtilization(r.plannedUtilizationPct)} (${r.plannedUtilizationPct}%), but actual utilization is currently ${describeUtilization(r.actualUtilizationPct)} (${r.actualUtilizationPct}%).`
    : "No workload is planned or tracked for today."

  const completionSentence = `They have completed ${r.overallCompletionRate}% of the overall workload, with ${r.dailyCompletionRate}% completion for the daily measure and ${r.assignedCompletionRate}% for assigned tasks.`

  const pendingSentence = r.pending > 0
    ? `There ${r.pending === 1 ? "is" : "are"} ${r.pending} pending task${r.pending === 1 ? "" : "s"}, ${r.overdue > 0 ? `${r.overdue} of which ${r.overdue === 1 ? "is" : "are"} overdue` : "but none are overdue"}, and the pending work is ${describeBacklogAge(r.pendingBacklogAvgAgeDays)} (${r.pendingBacklogAvgAgeDays} days average).`
    : (r.overdue > 0
      ? `There is no pending backlog, but ${r.overdue} task${r.overdue === 1 ? "" : "s"} ${r.overdue === 1 ? "is" : "are"} overdue.`
      : "There is no pending backlog and nothing overdue.")

  const patternSentence = r.recentEstimatedTasks?.length > 0
    ? `Their average resolution time is ${r.avgResolutionDays} days, while recent work is running about ${Math.round((r.recentOverrunProportion || 0) * 100)}% over estimate.`
    : `Their average resolution time is ${r.avgResolutionDays} days; there isn't yet enough completed, estimated work to gauge an overrun pattern.`

  const paragraph = [taskSentence, timeSentence, capacitySentence, completionSentence, pendingSentence, patternSentence].join(" ")

  const hasWarning = r.isCapacityOverrunToday || r.overdue > 0 || r.hasOverrunPattern || r.pendingBacklogAvgAgeDays > 2
  const headline = r.isCapacityOverrunToday
    ? `Over capacity today (${r.actualUtilizationPct}% actual vs ${r.plannedUtilizationPct}% planned).`
    : r.hasOverrunPattern
      ? `Recent work is trending over estimate (${Math.round((r.recentOverrunProportion || 0) * 100)}% of the last ${r.recentEstimatedTasks.length} tasks).`
      : r.overdue > 0
        ? `${r.overdue} task${r.overdue === 1 ? "" : "s"} overdue.`
        : taskSentence

  return { headline, paragraph, hasWarning }
}
