// One definition of what "today" and "this week" mean for a task list, shared by every
// surface so they can't drift.
//
// THE CRITICAL RULE: "today" must include OVERDUE open tasks. A naive
// `dueDate === today` filter would hide exactly the work that needs attention and
// silently break the overdue signal on the primary screen. Everything below is built
// around never hiding actionable work — when in doubt, a task stays visible.
//
// Locked Logic §7: "primary view is daily". Before this, every task surface showed
// all-time, so "Assigned Tasks: 143" was the first number an employee saw each morning.

export const TASK_SCOPES = ["today", "week", "all"]

const startOfDay = (date) => {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const addDays = (date, days) => {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Mongo filter fragment for a scope, or null for "all" (no constraint).
 *
 * A task is in scope when ANY of these hold:
 *   1. it's an INCOMPLETE daily task — regardless of its dailyDate. Daily tasks carry
 *      forward by design, so an unfinished one is always current work. Testing found
 *      that matching on `dailyDate` within the window hid 14 real, unfinished daily
 *      tasks whose carry-forward hadn't run yet (the provisioning cron had been down) —
 *      i.e. it hid today's work in exactly the failure mode where you most need to see it.
 *   2. it's a daily task COMPLETED inside the window (so today's finished dailies show)
 *   3. it's not completed and due on or before the horizon — INCLUDING overdue
 *   4. it's actively in flight (In Progress / Pending / In Review), regardless of dates.
 *      This is also what keeps a running timer's task visible: starting a timer sets
 *      the task to In Progress, so no work-session lookup is needed here.
 *   5. it was completed inside the window (so today's wins still show)
 *   6. it's blocked — blocked work is by definition waiting on attention
 *
 * @param {"today"|"week"|"all"} scope
 * @param {Date} referenceDate
 * @returns {object|null} a filter fragment suitable for $and, or null
 */
export const buildScopeFilter = (scope, referenceDate = new Date()) => {
  if (!scope || scope === "all") return null

  const days = scope === "week" ? 7 : 0
  const horizonEnd = addDays(referenceDate, days + 1)   // exclusive upper bound
  const windowStart = scope === "week" ? addDays(referenceDate, -7) : startOfDay(referenceDate)

  return {
    $or: [
      { isDaily: true, status: { $ne: "Completed" } },
      { isDaily: true, dailyDate: { $gte: windowStart, $lt: horizonEnd } },
      { status: { $ne: "Completed" }, dueDate: { $ne: null, $lt: horizonEnd } },
      { status: { $in: ["In Progress", "Pending", "In Review"] } },
      { status: "Completed", updatedAt: { $gte: windowStart } },
      { isBlocked: true }
    ]
  }
}
