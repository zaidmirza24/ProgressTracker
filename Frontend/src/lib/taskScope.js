// Client-side mirror of Backend/services/taskScopeService.js.
//
// Two callers, two reasons:
//  - The employee dashboard fetches with ?scope= and lets the server filter.
//  - The manager's Team Tasks table filters LOCALLY, because the manager's `tasks`
//    array also feeds capacity bars and the 7-day forecast — scoping that fetch would
//    starve them of the future-dated tasks they need. So the table narrows the view
//    without narrowing the data.
//
// Both must agree on what "today" means, hence one shared predicate here.
//
// THE CRITICAL RULE: "today" includes OVERDUE open tasks. Filtering on
// `dueDate === today` would hide precisely the work that needs attention.

export const TASK_SCOPES = ["today", "week", "all"]

export const SCOPE_LABELS = {
  today: "Today",
  week: "This week",
  all: "All time"
}

const startOfDay = (date) => {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const addDays = (date, days) => {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}

const ACTIVE_STATUSES = ["In Progress", "Pending", "In Review"]

/**
 * Is this task in scope? Mirrors buildScopeFilter's five clauses exactly.
 */
export const isTaskInScope = (task, scope, referenceDate = new Date()) => {
  if (!scope || scope === "all") return true

  const days = scope === "week" ? 7 : 0
  const horizonEnd = addDays(referenceDate, days + 1)   // exclusive
  const windowStart = scope === "week" ? addDays(referenceDate, -7) : startOfDay(referenceDate)

  // 1. Any INCOMPLETE daily task, whatever its dailyDate. Daily tasks carry forward by
  //    design, so an unfinished one is always current work — and if the provisioning
  //    cron is behind, its dailyDate will be stale while the work is still outstanding.
  if (task.isDaily && task.status !== "Completed") return true

  // 2. Daily task completed inside the window — today's finished dailies still show
  if (task.isDaily && task.dailyDate) {
    const d = new Date(task.dailyDate)
    if (d >= windowStart && d < horizonEnd) return true
  }

  // 2. Open and due on or before the horizon — this is what keeps overdue visible
  if (task.status !== "Completed" && task.dueDate && new Date(task.dueDate) < horizonEnd) return true

  // 3. Actively in flight, whatever its dates (also covers the running timer's task,
  //    since starting a timer sets the task to In Progress)
  if (ACTIVE_STATUSES.includes(task.status)) return true

  // 4. Finished inside the window — today's wins still show
  if (task.status === "Completed" && task.updatedAt && new Date(task.updatedAt) >= windowStart) return true

  // 5. Blocked work is waiting on attention by definition
  if (task.isBlocked) return true

  return false
}

export const filterTasksByScope = (tasks, scope, referenceDate = new Date()) =>
  (!scope || scope === "all") ? tasks : tasks.filter(t => isTaskInScope(t, scope, referenceDate))
