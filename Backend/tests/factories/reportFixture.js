import { buildOrg } from "./org.js"
import { makeTask, makeDailyTask, historyEntry } from "./task.js"
import { makeStoppedSession } from "./session.js"
import { setOrgSettings } from "./orgUnit.js"

// A deterministic organisation whose progress report has known, hand-checkable numbers.
//
// Every value below is chosen so a metric lands on a boundary worth testing rather than
// on a comfortable middle: the overrun pattern sits just UNDER its threshold, the
// quality signal sits just UNDER its minimum sample, one completed task exactly equals
// its estimate (so "not overrun" is proved rather than assumed), and the blocked task is
// aged across a weekend so working-day counting has to be right.
//
// Must be called with the clock frozen to REPORT_NOW.

// Monday 16 March 2026, mid-morning, local time.
export const REPORT_NOW = new Date(2026, 2, 16, 10, 0, 0)

const at = (day, hour = 12) => new Date(2026, 2, day, hour)
const HOUR = 3600

export const buildReportFixture = async () => {
  // A full Mon–Fri working week with no holidays, so capacity is the plain 8 − 1 = 7.
  await setOrgSettings({ workingDays: [1, 2, 3, 4, 5], holidays: [] })

  const org = await buildOrg()
  const ana = org.employeeA1
  const manager = org.managerA

  // ── Daily work: one done, one carried forward ───────────────────────────────
  const dailyDone = await makeDailyTask({
    assignedTo: ana, title: "Morning standup",
    dailyDate: at(16, 0), originalDailyDate: at(16, 0),
    estimatedHours: 1, status: "Completed"
  })
  await makeStoppedSession({ task: dailyDone, employee: ana, seconds: 1 * HOUR, startedAt: at(16, 9) })

  const dailyCarried = await makeDailyTask({
    assignedTo: ana, title: "Inbox triage",
    dailyDate: at(16, 0), originalDailyDate: at(13, 0),
    estimatedHours: 1, status: "Not Started", isCarryForward: true
  })

  // ── In flight today, and running over its estimate ──────────────────────────
  // Due at 23:00 so it lands on today WITHOUT counting as overdue at 10:00.
  const overrunning = await makeTask({
    assignedTo: ana, assignedBy: manager, title: "Payment reconciliation",
    dueDate: at(16, 23), estimatedHours: 3, status: "In Progress"
  })
  await makeStoppedSession({ task: overrunning, employee: ana, seconds: 4 * HOUR, startedAt: at(16, 8) })

  // ── Overdue, untouched ──────────────────────────────────────────────────────
  const overdue = await makeTask({
    assignedTo: ana, assignedBy: manager, title: "Quarterly filing",
    dueDate: at(13, 12), estimatedHours: 2, status: "Not Started"
  })

  // ── Reviewed and approved first time, tracked exactly to estimate ───────────
  const approvedFirstPass = await makeTask({
    assignedTo: ana, assignedBy: manager, title: "Vendor summary",
    estimatedHours: 2, status: "Completed",
    history: [
      historyEntry({ from: "In Progress", to: "In Review", changedBy: ana, timestamp: at(12, 9) }),
      historyEntry({ from: "In Review", to: "Completed", changedBy: manager, timestamp: at(12, 15) })
    ]
  })
  await makeStoppedSession({ task: approvedFirstPass, employee: ana, seconds: 2 * HOUR, startedAt: at(12, 9) })

  // ── Returned once, then approved — and it overran ───────────────────────────
  const reworked = await makeTask({
    assignedTo: ana, assignedBy: manager, title: "Client onboarding pack",
    estimatedHours: 1, status: "Completed",
    history: [
      historyEntry({ from: "In Progress", to: "In Review", changedBy: ana, timestamp: at(11, 9) }),
      historyEntry({ from: "In Review", to: "In Progress", changedBy: manager, comment: "Missing the pricing appendix", timestamp: at(11, 14) }),
      historyEntry({ from: "In Progress", to: "In Review", changedBy: ana, timestamp: at(12, 10) }),
      historyEntry({ from: "In Review", to: "Completed", changedBy: manager, timestamp: at(12, 16) })
    ]
  })
  await makeStoppedSession({ task: reworked, employee: ana, seconds: 2 * HOUR, startedAt: at(11, 9) })

  // ── Blocked since the previous Wednesday, i.e. across a weekend ─────────────
  const blocked = await makeTask({
    assignedTo: ana, assignedBy: manager, title: "Data migration",
    status: "Pending", isBlocked: true,
    blockedReason: "Waiting on the vendor's export", blockedAt: at(11, 10), blockedBy: manager
  })

  return {
    org,
    ana,
    manager,
    tasks: { dailyDone, dailyCarried, overrunning, overdue, approvedFirstPass, reworked, blocked }
  }
}
