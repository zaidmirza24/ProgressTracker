# Test Results — Phases 1–5

*Run 2026-08-16 against live seed data on an isolated server (port 3100). The dev server on
:3000 was untouched throughout.*

**79 API-level checks — 77 passed on first run, 2 failed and were fixed, all 79 pass now.**

Browser/click testing was out of scope (no tooling, declined). Everything below is API and
database level.

---

## Two real bugs found and fixed

### 1. Scope filter hid 14 incomplete daily tasks (Phase 5)

Matching daily tasks on `dailyDate` within the window meant that when the provisioning cron
hadn't run, unfinished daily tasks kept a stale `dailyDate` and **vanished from the employee's
Today view** — hiding today's work in exactly the failure mode where you most need to see it. The
live database had 14 such tasks (dailyDates stranded at Aug 12–15).

**Fix:** any *incomplete* daily task is in scope regardless of `dailyDate`. Daily tasks carry
forward by design, so an unfinished one is always current work. Applied to both
`taskScopeService.js` and `taskScope.js`.

**After:** 0 overdue, 0 incomplete dailies, 0 in-flight and 0 blocked tasks hidden from Today.

### 2. Auto-unblock never fired on timer *start* (Phase 3)

`startSession` sets the task to In Progress **directly** rather than through `setTaskStatus`,
where the unblock logic lived. Resume worked; start silently didn't — so a task could be actively
worked on while still showing a "Blocked" badge.

**Fix:** extracted `clearBlockedIfSet(task, changedBy)` and called it from both paths.

---

## Results by phase

| Suite | Checks | Result |
|---|---|---|
| Security — visibility scope | 6 | all pass |
| Scope semantics (Phase 5) | 5 | 1 failed → fixed → passes |
| Regression — core lifecycle | 14 | all pass |
| Blocked (Phase 3) | 20 | 2 failed → fixed → pass |
| Auto-unblock retest | 5 | all pass |
| Quality/rework (Phase 4) | 8 | all pass |
| Work calendar (Phase 2) | 14 | all pass |
| Absence (Phase 2b) | 18 | all pass |
| Mutation suite re-run (Phase 1) | 15 | all pass |

### Security — the one that mattered most

The `$and` restructure in `getTasks` (needed because role visibility and scope both use `$or`)
could have widened a manager's visibility. It didn't:

- 0 out-of-scope tasks leaked at any scope (`all` / `week` / `today`)
- 0 overlap between the two managers' task sets
- employees see only their own tasks
- `?assignedTo=<non-report>` returns 0 tasks — the parameter narrows within scope, never widens it

### Notable confirmations

- **Paused time is no longer counted as worked time** — a pause/resume cycle recorded 3s, not the
  wall-clock gap (the Phase 1A bug, confirmed fixed end to end).
- **Today was a Sunday during testing**, so the whole team correctly reported `capacity 0`,
  `plannedUtilizationPct: null`, `isCapacityOverrunToday: false` — the "everyone looks 0% utilised
  on a Sunday" bug, demonstrated fixed on real data.
- **Rework metrics work retroactively** — Alex Kim showed 1 reviewed / 0% first-pass / 100% rework
  from data that already existed, with the manager's feedback text captured. No migration.
- **Reassignment with a live timer preserved tracked time** and stopped the original assignee's
  session, with the work-session row retained.
- **Blocking is genuinely orthogonal** — blocking a `Not Started` task left the status at
  `Not Started`; pausing a timer did *not* set `isBlocked`.
- **Provisioning correctly skips** both non-working days and absent employees.

---

## Known imprecision (accepted, not a bug)

"Completed within the window" uses `updatedAt`, so a task completed weeks ago but commented on
today would appear in Today's scope. Exact detection would need the history entry for the
transition into `Completed`. At this data volume it isn't worth the query cost — noted rather
than fixed.

---

## Data left behind

None. All 6 probe tasks and their work sessions removed, 1 test absence removed, calendar settings
restored to `workingDays=[1,2,3,4,5]`, `holidays=0`.

Final integrity check: 0 out-of-enum statuses, 46 active tasks, 1 soft-deleted (pre-existing from
Iteration 13), 0 blocked, 0 orphaned running sessions, 0 leftover probes.

One intended new document exists: the `OrgSettings` singleton, lazily created on first read.

---

## Still untested

- **All UI rendering.** Every component change across Phases 1B, 1C, 2, 3, 4, 5 is verified only
  by lint + build. No button has been clicked.
- Optimistic update and rollback behaviour in `useTaskMutation`.
- The client-side scope predicate in `taskScope.js` (its server twin is tested; the mirror is not).
- Capacity/forecast rendering against the calendar.
- The `409 TASK_MODIFIED` reload prompt.

The API and data layers underneath all of it are now exercised.
