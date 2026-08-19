# Phase 3 — Paused vs Blocked

*Implements P0 item 3 of `docs/product-gap-solutions.md`.*

**Status: CODE COMPLETE — COMPILES CLEAN, BEHAVIOUR UNVERIFIED (2026-08-16)**

- `node --check` + import resolution on all changed backend files — OK
- `npm run lint` — 0 issues in Phase 3 files; total 16, unchanged from baseline
- `npm run build` — passes, 3006 modules
- No runtime check, no API call, nothing clicked.

---

## The problem

`workSessionController.setTaskStatus` flips a task to `Pending` on every pause, stop and
task-switch. `getPendingAgeDays` then measured "how long has this been pending" from that
transition — so an employee who stopped their timer at 6pm had a task "pending" for 15 hours by
morning, and 63 by Monday. One of the seven core signals was mostly measuring evenings and
weekends.

There was also no way for anyone to say **"I'm stuck"** — arguably the single most useful thing a
manager can learn, and the one thing the person doing the work always knows first.

---

## The approach: a flag, not a sixth status

`isBlocked` is **orthogonal to status**. Status answers *"where is this in the workflow?"*;
blocked answers *"can it proceed?"*. Conflating them is what caused the bug in the first place.

Consequences of the orthogonal design:
- **Zero changes** to `config/workflow.js`, `isValidTransition`, the stepper, or the locked
  5-state workflow.
- A task can be blocked in any state — Not Started, In Progress, Pending or In Review.
- Blocked is **not** a Kanban column, because it isn't a stage.

### The "Pending" → "Paused" relabel was NOT done

`product-gap-solutions.md` recommended relabelling the `Pending` status to "Paused" in the UI,
flagged as needing sign-off because the locked doc names that state "Pending". That sign-off
hasn't happened, so the status label is untouched.

It turned out not to be needed for the fix: the misleading metric is corrected by *splitting the
measurement*, not by renaming the state. Where the two concepts are now reported side by side
(signals panel, personal progress) the words "paused" and "blocked" are used as descriptions, and
`STATUS_VARIANTS` / badges still say "Pending". Worth revisiting for clarity, but nothing depends
on it.

---

## What changed

### Backend

| File | Change |
|---|---|
| `models/Task.js` | `isBlocked`, `blockedReason`, `blockedAt`, `blockedBy` + `{isBlocked, isActive}` index |
| `controllers/taskController.js` | New `setTaskBlocked`; new `getBlockedAgeDays` (working days); report split into paused vs blocked; org health gains `blockedTasks`. **Removed `getPendingAgeDays`** — dead once the metric moved |
| `controllers/workSessionController.js` | Starting/resuming a timer auto-clears the blocked flag and logs it — work is demonstrably proceeding, so a stale "Blocked" badge can't linger |
| `routes/taskRoutes.js` | `PATCH /api/tasks/:id/blocked` |

**Why a separate endpoint:** the **assignee** can declare their own task blocked even though they
can't edit its other fields. That's a different authorization rule from the field-edit `PATCH`,
so it gets its own route rather than a special case inside one.

### New report fields

```
pausedCount                  // status === "Pending" && !isBlocked — a COUNT only, never aged
blockedCount
blockedBacklogAvgAgeDays     // working days since blockedAt
blockedBacklogOldestAgeDays
blockedTasks[]               // { _id, title, reason, status, ageDays } — traceability (§12)
```
`pendingBacklogAvgAgeDays` / `pendingBacklogOldestAgeDays` are retained as **deprecated aliases**
now carrying the blocked-based figure — which is what the label always meant. Prefer
`blockedBacklog*` in new code.

### Frontend

**New:** `components/tasks/BlockedPanel.jsx` — self-gating panel used by *both* the employee and
manager detail modals. Shows the reason, who flagged it and since when; one click to unblock.

**Changed:** `useTaskMutation` (`setBlocked`), `useTaskActions` (`handleToggleBlocked`),
`TaskActionMenu` (Unblock inline; "Mark blocked…" opens the modal since a reason is required),
`EmployeeDashboard` (wired `useTaskMutation` so employees can block), `AttentionZone` (new
blocked item, deep-links to `/team-tasks?filter=blocked`), `TeamTasksTable` (blocked filter +
badge), `TeamSignalsPanel` (new **Blocked** signal block; Deadline block now shows Paused with
"paused = timer off, not stuck"), plus blocked badges on `TaskListView`, `TaskKanbanBoard`,
`DailyTasksSection`, `TeamWorkloadTracker`, `TaskDetailModalCore`, and updated
`MyProgress` / `MyProgressSection` / `EmployeeDrilldownModal` / `buildEmployeeSignalSummary`.

---

## Edge cases handled

| Case | Behaviour |
|---|---|
| Timer started on a blocked task | Auto-unblocks, written to history |
| Block without a reason | 400 `REASON_REQUIRED` |
| Blocking an already-blocked task | 409 `ALREADY_BLOCKED` |
| Blocking a Completed task | 409 `TASK_LOCKED` |
| Blocked across a weekend | Age in working days, so it doesn't inflate |
| Blocked task reassigned | Flag and reason carry with the task |
| Blocked while In Review | Allowed — a review can be blocked on the reviewer |
| Repeat blocking | Each block/unblock pair is a history entry; age measures from the current `blockedAt` only |
| Employee blocking a colleague's task | 403 — assignee or manager scope only |

---

## Migration

**None.** New fields default to `false`/`null`, so every existing task reads as unblocked — which
is accurate, since nobody could declare a block until now. Historical pending-age values were
computed live and never stored, so there's nothing to correct.

---

## What a test pass should cover

1. Employee marks own task blocked → badge appears everywhere; manager's Attention Zone counts it.
2. Employee starts the timer on it → auto-unblocks, history records why.
3. Pause a timer → task goes Pending, **is not** counted as blocked, and accrues no blocked age.
4. Blocked over a weekend → age counts working days only.
5. Manager unblocks from the row menu without opening the modal.
6. `/team-tasks?filter=blocked` shows exactly the blocked set.
7. Signals panel: Paused and Blocked read as separate things.
8. Block → reassign → flag and reason follow the task.
9. Block attempts on Completed / already-blocked tasks rejected.
10. **Regression:** Phase 1 (edit/reassign/cancel/move) and Phase 2 (calendar/absence) still work.
