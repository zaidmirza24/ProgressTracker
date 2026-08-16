# Implementation Tasks — Phase 1: Task Mutation + Action Surfaces

*Covers steps 1–2 of `docs/product-gap-solutions.md` (P0 item 1, gaps 1 & 6 core).*
*Prerequisite for: gap 6 extended wiring, user deactivation. Independent of: gaps 2, 3, 4.*

**Goal:** a manager can edit, reassign, reschedule, and cancel a task, from wherever the task
appears, with capacity recalculating live.

**No test runner exists in this repo.** Verification per task is `node --check` (backend),
`npm run lint` + `npm run build` (frontend), and a throwaway script against live data — the same
approach Iterations 8, 9, 11, and 13 used. Do not commit verification scripts.

---

## Sub-phase 1A — Backend mutation API ✅ COMPLETE (2026-08-16)

Shippable on its own (API works via curl/Postman; no UI yet).

**All 18 verification scenarios passed.** Two things came up that weren't in the original plan:

1. **Bug found and fixed during T1.** Both inline stop-blocks in `updateTaskStatus` measured
   elapsed time from `startedAt` and ignored pause/resume `events` entirely — so any session
   stopped via a *status transition* (rather than the timer's own stop endpoint) counted paused
   time as worked time. Measured on a real case: **7200s recorded for 10s of actual work.** The
   extraction to `taskService.js` fixes it, since all paths now share the events-aware calculation.
2. **`AppError` gained an optional third `code` argument** (+ `errorMiddleware` emits it). Not in
   the plan, but required: the frontend must branch on `TASK_MODIFIED` to show a reload prompt,
   and string-matching messages would be fragile. Backward compatible — existing two-arg calls
   are unaffected. Only string codes are emitted, so Mongoose's numeric `11000` can't leak.

**Separately: a live data bug was found and fixed (with sign-off).** Three active tasks still held
`status: "Waiting for Review"` from the 8-state enum Iteration 6 retired — the schema changed but
existing documents were never migrated. They were frozen (no valid transition for any role) and
returned 500 on any comment. Migrated to `"In Review"`; 0 tasks now hold an out-of-enum status.
Rollback reference: `6a7ce832…7510`, `…7514`, `…7515`.

---

### T1 · Extract `stopRunningSessionForTask` into a service

**Files:** create `Backend/services/taskService.js`; edit `Backend/controllers/taskController.js`

The stop-a-running-session logic is currently inline in `updateTaskStatus`
(`taskController.js`, the `oldStatus === "In Progress"` branch) and duplicated in
`workSessionController.js` as `performStopSession`. PATCH and DELETE both need it.

```js
// Backend/services/taskService.js
import WorkSession from "../models/WorkSession.js"

// Stops the running session for a task, preserving accumulated seconds.
// Locked §2 — sessions are retained, never discarded.
// Returns the stopped session, or null if none was running.
export const stopRunningSessionForTask = async (taskId, employeeId = null) => { ... }
```

- Must handle a session with `events` (paused/resumed) correctly — reuse the same elapsed
  calculation shape as `workSessionController.calculateSessionTime`, don't write a third variant.
- Refactor `updateTaskStatus` to call it. **Do not** change `workSessionController.js` in this
  task — that's a wider refactor and rule §36 says don't expand scope.

**Done when:** `updateTaskStatus` behaves identically (start a timer, move the task to Pending via
the UI, confirm `totalSeconds` and `stoppedAt` are written exactly as before).

---

### T2 · Widen the `history` sub-schema

**File:** `Backend/models/Task.js`

- `fromStatus` and `toStatus` → drop `required: true` (keep the fields).
- Add `changes: [{ field: String, from: String, to: String }]`.

Store **display values** in `from`/`to` (e.g. assignee names, formatted dates), not raw ObjectIds
— `TaskDetailModalCore`'s history timeline renders them directly and does no extra populates.

**Done when:** existing tasks still load and their history timeline renders unchanged (open any
task with history in the UI). No migration, no backfill.

---

### T3 · `PATCH /api/tasks/:id`

**Files:** `Backend/controllers/taskController.js`, `Backend/routes/taskRoutes.js`

New `updateTask` controller. Follow the file's existing conventions: `asyncHandler`, `AppError`,
explicit destructuring (no `req.body` spread — mass-assignment protection, matching `createTask`).

**Editable fields:** `title`, `description`, `category`, `priority`, `estimatedHours`, `dueDate`,
`assignedTo`, `department`.

**Authorization** — reuse `hasTaskAccess(req, task)`, then layer field rules:

| Caller | Allowed |
|---|---|
| `super_admin` | all fields, any task |
| `manager` | all fields, within `hasTaskAccess` scope |
| `employee` | `title`, `description`, `priority`, `estimatedHours`, `dueDate` — **only** on tasks where `assignedBy === assignedTo === req.user.id`, and only while not Completed. Never `assignedTo` |

Forbidden field → `403 { code: "FIELD_NOT_EDITABLE" }`. Do not silently drop it.

**Validation:**
- `title` — trimmed, non-empty, ≤ 200
- `estimatedHours` — finite number, `0 ≤ h ≤ 100`; reject `NaN` and negatives
- `dueDate` — parseable or `null`; a past date is **allowed** but returns `warning` in the response
- `assignedTo` — must exist, be `isActive: true`, and be in the caller's scope (a manager may only
  reassign to their own direct reports or themselves)
- `priority` — enum; `category` — trimmed string

**Guards:**
- `task.status === "Completed"` → `409 { code: "TASK_LOCKED" }` (Locked §4)
- `!task.isActive` → `404` (matches existing behaviour)
- **Daily task + `assignedTo` change** → `400 { code: "DAILY_TASK_NOT_REASSIGNABLE" }`. Daily tasks
  are template-derived and bound to one employee by the provisioning cycle
- Body includes `updatedAt` mismatching the stored value → `409 { code: "TASK_MODIFIED" }` (§29)

**Side effects:**
- On `assignedTo` change with a running session → call `stopRunningSessionForTask` (T1), then set
  status `In Progress → Pending`. Never delete the session
- Push **one** history entry per request with the full `changes[]` array

**Response:** same populated shape `updateTaskStatus` returns (`assignedTo`, `assignedBy`,
`department`, `comments.author`, `history.changedBy` populated, run through `getTaskWithTime`) so
the frontend reconcile path is identical for both hooks.

**Route:** `router.patch("/:id", updateTask)` — auth comes from the router-level `authenticateJWT`;
role nuance is handled in the controller, matching `updateTaskStatus`.

**Done when:** curl/Postman confirms — a manager edits an estimate; an employee is `403`'d on
someone else's task; a Completed task is `409`'d; a reassign with a live timer stops the session
and preserves `totalSeconds`; a stale `updatedAt` is `409`'d.

---

### T4 · `DELETE /api/tasks/:id` (soft-delete)

**Files:** `Backend/controllers/taskController.js`, `Backend/routes/taskRoutes.js`

- Sets `isActive: false` + one history entry carrying the required `reason`. **No new
  `cancelledAt`/`cancelledBy` fields** — history already answers who and when (§8).
- `manager`/`super_admin` within `hasTaskAccess` scope. Employees may cancel only their own
  self-created tasks that are still `Not Started`.
- `status === "Completed"` → `409`. Completed work is part of the historical record.
- Running timer → `stopRunningSessionForTask` first.
- `reason` required, ≤ 300 chars.
- Never touch `WorkSession` documents beyond stopping.

**Done when:** a cancelled task disappears from `GET /api/tasks`, its `WorkSession` rows still
exist in the DB, and the history entry records the reason.

---

### T5 · Verify daily-task provisioning is unaffected

**File:** none — verification only.

Confirmed by reading, must be confirmed by running: `provisionDailyTasksForEmployee`'s existence
check (`Task.findOne({ assignedTo, templateRef, dailyDate })`) **does not filter `isActive`**, so a
cancelled daily task is not regenerated the same day but *is* regenerated tomorrow. The
carry-forward query *does* filter `isActive: true`, so it won't carry forward.

⚠️ **Do not "fix" the missing `isActive` filter** — it is load-bearing for this behaviour.

**Done when:** a throwaway script confirms: cancel today's daily task → re-run
`provisionDailyTasksForEmployee` → it is not recreated today; simulate tomorrow → it is created.

---

**Sub-phase 1A ships when:** `node --check` passes on every changed backend file, and the five
scenarios in T3/T4 are verified against live data.

---

## Sub-phase 1B — Edit & cancel in the task detail modal ✅ CODE COMPLETE (2026-08-16)

Shippable on its own (managers can edit from the detail modal; the action menu comes in 1C).

**Lint and build pass; Vite compiles every new module.** ⚠️ **Not yet click-tested in a browser**
— no browser tooling in this environment and installing it was declined. The API layer underneath
is fully verified (1A), but the React render path has not been exercised. Worth a manual pass over
the Phase 1 test script rows 1–5 before shipping.

Two deviations from the task list, both to fix problems the plan didn't anticipate:

1. **T7's capacity preview uses a projected task list, not delta arithmetic.** The plan said to
   pass `newHours − currentHours` as `extraHours`. That's correct only when the assignee and due
   date are unchanged — a changed due date moves the load to another day and a reassignment moves
   it to another person, and the delta gets both wrong. Instead the edited values are projected
   into a copy of the tasks array and measured with `extraHours: 0`, which handles all three
   changes at once with nothing to get wrong.
2. **`EMPTY_TASK_FORM` became `emptyTaskForm()` in a new `lib/taskFormState.js`.** As a
   module-level constant its `dueDate: getLocalDateString()` would have been frozen at app load,
   so a session left open past midnight would pre-fill yesterday. Making it a function also
   resolved a `react-refresh/only-export-components` lint error from exporting helpers beside a
   component.

Also: `CancelTaskDialog` resets its reason field via a `key` on the parent rather than a
`useEffect`, satisfying the repo's `react-hooks/set-state-in-effect` rule.

Lint went from 19 problems to 16 — the three that disappeared were pre-existing ones in the old
`CreateTaskModal.jsx`, which this replaced.

---

### T6 · `useTaskMutation` hook

**File:** create `Frontend/src/hooks/useTaskMutation.js`

Direct sibling of `useTaskStatusMutation.js` — **copy its shape exactly**: snapshot → optimistic
patch → request → reconcile with server response → roll back on failure.

```js
export function useTaskMutation({ tasks, setTasks, detailTask, setDetailTask, setSubmitting, onSuccess }) {
  const patchTask = async (taskId, fields) => { ... }   // PATCH
  const cancelTask = async (taskId, reason) => { ... }  // DELETE — optimistically removes from array
  return { patchTask, cancelTask }
}
```

- `setTasks` in both dashboard stores already accepts a functional updater — use it.
- Surface errors via `useToast` (`context/ToastContext.jsx`), with specific copy for
  `TASK_MODIFIED` ("This task was changed by someone else. Reload to see the latest.") and
  `TASK_LOCKED`.
- Send `updatedAt` from the current task object on every PATCH.

**Why this matters:** capacity, the Attention Zone counts, and the forecast are all derived from
the `tasks` array, so this optimistic patch is what makes "capacity recalculates immediately" work.
No extra plumbing needed.

**Done when:** an edit updates the row instantly and a forced 500 rolls it back with a toast.

---

### T7 · Generalise `CreateTaskModal` → `TaskFormModal`

**File:** `Frontend/src/components/dashboards/manager/CreateTaskModal.jsx` → rename to
`Frontend/src/components/tasks/TaskFormModal.jsx`; update imports in `TeamCommandCenter.jsx`

Add `mode: "create" | "edit"` and `taskId`. Keep every existing field, the Advanced Settings
toggle, and the capacity-warning banner.

⚠️ **The one subtle difference:** in edit mode the capacity preview must **exclude the task's own
current `estimatedHours`** from the assignee's planned total before adding the new value —
otherwise every edit looks like it doubles the load. `getEmployeeCapacity(emp, tasks, extraHours, day)`
already takes `extraHours`; pass `newHours − currentHours` when editing.

Leave the **employee** `CreateTaskModal` (`dashboards/employee/`) alone — decisions.md §9 records a
deliberate choice not to merge those two, and it still holds.

**Done when:** create works exactly as before (smoke-test first), and edit mode pre-fills, saves,
and shows a correct capacity delta.

---

### T8 · `TaskAdminPanel` component

**File:** create `Frontend/src/components/tasks/TaskAdminPanel.jsx`; wire into
`Frontend/src/components/tasks/ManagerTaskDetailModal.jsx`

Follow `ApprovalGatingPanel.jsx`'s convention exactly: **the component self-gates** (returns `null`
when it has nothing to show) so the shell doesn't branch on status.

- Renders `null` when `detailTask.status === "Completed"`.
- Buttons: **Edit task** (opens `TaskFormModal` in edit mode), **Cancel task**.
- Passed to `TaskDetailModalCore` via the existing `actionPanel` prop — but note
  `ManagerTaskDetailModal` currently passes `ApprovalGatingPanel` there. Render both in a fragment;
  each self-gates, so only one shows at a time in practice.

**Done when:** the panel appears on open tasks, is absent on Completed ones, and does not disturb
the In Review approval flow.

---

### T9 · Cancel confirmation dialog

**File:** create `Frontend/src/components/tasks/CancelTaskDialog.jsx`

- shadcn `Dialog` — **not** native `confirm()`. The audit doc already flagged the one remaining
  `confirm()` in `TaskTemplatesTab.jsx` as debt; don't add a second.
- Names the task, requires a reason (submit disabled until non-empty), warns if a timer is
  currently running on it.
- Submitting state on the button; the dialog stays open and preserves input on error (§18).

**Done when:** cancelling removes the task from every list optimistically and a failure restores it.

---

**Sub-phase 1B ships when:** `npm run lint` and `npm run build` pass, and a manager can edit,
reassign, reschedule, and cancel from the detail modal with capacity bars updating live.

---

## Sub-phase 1C — Actions where problems are discovered ✅ CODE COMPLETE (2026-08-16)

This is the sub-phase that actually closes Insight → Action.

Lint (16 problems, all pre-existing in untouched files) and build both pass.
⚠️ **Not click-tested in a browser** — same caveat as 1B.

**One structural addition beyond the task list:** `hooks/useTaskActions.js` +
`components/tasks/TaskActionDialogs.jsx`. `TeamTasksPage` needs the identical action set to
`TeamCommandCenter`, and copying ~80 lines of handlers plus three dialogs into it would be exactly
the copy-paste drift decisions.md §6 warns about. Both shells now call one hook and render one
dialog bundle.

**Scope cut, deliberate:** T11 listed the employee surfaces (`TaskListView`, `TaskKanbanBoard`)
too. Those are skipped for now — employee-side editing needs the *employee* CreateTaskModal
generalised as well, and that's a separate piece of work with much lower value than the manager
loop. Tracked as 1D below. The backend already permits it (`EMPLOYEE_EDITABLE_FIELDS`), so it's
purely a UI addition whenever it's wanted.

**A near-miss worth recording:** a regex used to strip the old inline wiring from
`TeamCommandCenter` also removed its mount `useEffect`, which is what calls `loadData`. The
Overview page would have rendered permanently empty. Caught by `no-unused-vars` on the now-unused
`useEffect` import — a good argument for running lint after scripted edits, not just after
hand-edits.

### 1D — Employee-side task actions (not started)

Small follow-up: generalise `dashboards/employee/CreateTaskModal.jsx` the same way, wire
`useTaskMutation` into `EmployeeDashboard`, and mount `TaskActionMenu` (View/Edit only) on
`TaskListView` and `TaskKanbanBoard` for self-created, non-completed tasks.

---

### T10 · `TaskActionMenu` component

**File:** create `Frontend/src/components/tasks/TaskActionMenu.jsx`

Use the existing `components/ui/dropdown-menu.jsx` primitive (`@radix-ui/react-dropdown-menu` is
already a dependency).

| Role | Items |
|---|---|
| manager / super_admin | View details · Edit · Reassign… · Move to tomorrow · Pick date… · Cancel task |
| employee (own self-created, not completed) | View details · Edit |
| employee (manager-assigned) | View details |

- Hide (don't disable) actions the caller can't perform — the server rejects them anyway.
- Hide **Reassign** on daily tasks (T3 rejects it server-side).
- Hide everything but View details when `status === "Completed"`.
- `stopPropagation` on the trigger — every one of these rows already has a row-level `onClick` that
  opens the detail modal.

**Done when:** the menu renders correctly for all three role/status combinations.

---

### T11 · Mount the action menu on task surfaces

**Files:** `TeamTasksTable.jsx`, `TaskKanbanBoard.jsx`, `TaskListView.jsx`,
`TeamWorkloadTracker.jsx`, `PendingReviewQueue.jsx`

Use Iteration 13's carry-forward-badge rollout as the checklist of places a task-level affordance
must appear — it enumerates every surface a task can show up on.

**Done when:** every task row/card in the app exposes the menu, and row-click-to-open-detail still
works everywhere.

---

### T12 · "Move to tomorrow" quick action

**File:** `Frontend/src/lib/taskHelpers.js` (helper) + `TaskActionMenu.jsx`

- One click → `patchTask(id, { dueDate: tomorrow })`, toast naming the new date.
- No confirmation — it's trivially reversible.
- ⚠️ Leave a `TODO(gap-2)` comment: once the work calendar lands, this must skip to the next
  **working** day. Don't try to anticipate it now.

**Done when:** the date moves, the row updates, and overdue/capacity counts recompute instantly.

---

### T13 · Reassign picker with capacity hints

**File:** `Frontend/src/components/tasks/ReassignDialog.jsx` (new)

The highest-value small touch in the whole phase. The assignee dropdown must show each candidate's
**remaining capacity for that task's due date** — "Arjun — 3.5h free", "Priya — over capacity".
`getEmployeeCapacity(emp, tasks, 0, dueDate)` already returns exactly this.

- Never block an over-capacity choice — flag it (Locked §6: flag, don't prevent).
- Managers see their direct reports; super_admin sees everyone (mirror
  `useManagerDashboardStore`'s existing `employees` scoping).

**Done when:** reassigning updates both employees' capacity bars in the same frame.

---

### T14 · Expandable over-capacity workload card

**File:** `Frontend/src/components/dashboards/manager/TeamWorkloadTracker.jsx`

Mirror `TeamSignalsPanel.jsx`'s existing row-expansion pattern — don't invent a second disclosure
idiom (§37).

- Expanding shows **the tasks driving the load**, largest `estimatedHours` first, each with inline
  Move-to-tomorrow and Reassign.
- Capacity bar and the "over capacity" flag update live as the manager works.

**Done when:** the canonical loop runs end to end without a page reload:
`Attention Zone flag → expand card → see causes → reassign/reschedule → bar drops → flag clears.`

---

### T15 · Deep-link the Attention Zone's overdue item

**Files:** `Frontend/src/components/dashboards/manager/AttentionZone.jsx`,
`Frontend/src/pages/dashboards/TeamTasksPage.jsx`, `TeamTasksTable.jsx`

Currently navigates to `/team-tasks` **unfiltered**, so the manager arrives at a full table and has
to find the overdue rows themselves.

- Navigate to `/team-tasks?filter=overdue`; `TeamTasksTable` reads it via `useSearchParams`.
- Filter state belongs in the URL, not local state — it's shareable and back-button-correct (§24).
- Show an active-filter chip with a clear affordance.

**Done when:** the click lands on a pre-filtered table.

---

**Sub-phase 1C ships when:** the full loop in T14 works, `npm run lint` and `npm run build` pass.

---

## Phase 1 manual test script

Run against seeded data before calling the phase done.

| # | Scenario | Expected |
|---|---|---|
| 1 | Manager edits a task's estimate 2h → 5h | Row + capacity bar update instantly; history shows the change |
| 2 | Manager reassigns a task **with a live running timer** | Session stopped, `totalSeconds` preserved, status → Pending, both capacity bars update |
| 3 | Manager reassigns a **daily** task | Action hidden in UI; `400` if forced via API |
| 4 | Manager cancels a task | Gone from all lists; `WorkSession` rows still in DB; reason in history |
| 5 | Manager tries to edit a **Completed** task | No Edit button; `409 TASK_LOCKED` if forced |
| 6 | Employee tries to PATCH a colleague's task | `403` |
| 7 | Employee edits their own self-created task's estimate | Succeeds |
| 8 | Employee tries to change `assignedTo` on their own task | `403 FIELD_NOT_EDITABLE` |
| 9 | Two browser tabs edit the same task | Second gets `409 TASK_MODIFIED` + reload prompt |
| 10 | Force a 500 on PATCH | Optimistic change rolls back; toast shown |
| 11 | Cancel today's daily task, re-run provisioning | Not recreated today; recreated tomorrow |
| 12 | Over-capacity loop (T14) | Flag clears without a reload |
| 13 | Existing flows untouched | Create task, start/pause/stop timer, approve, send for rework, add comment all behave exactly as before |

Row 13 is the regression guard and is the one not to skip.

---

## What Phase 1 must NOT touch

- `Backend/config/workflow.js` — the 5-state workflow is locked
- `workSessionController.js`'s timer logic — only *call* the extracted stop helper from new places
- `dailyTaskService.js`'s loop ordering or its `isActive`-agnostic existence check (both load-bearing)
- `getProgressReport` — no metric changes in this phase
- The employee `CreateTaskModal` — deliberately not merged (decisions.md §9)
- `TeamCommandCenter`'s shared Manager/Admin structure — add to it, don't fork it

---

## After Phase 1

Coarse outline only — each gets its own task doc when it comes up, sized like this one.

| Phase | Scope | Depends on |
|---|---|---|
| **2 — Work calendar** | `OrgSettings` + `Absence` models, `calendarService`, cron/provisioning guards, calendar-aware capacity in *both* places it's computed, Work Calendar tab, `AbsenceDialog`. **Includes de-duplicating the capacity formula first** | — |
| **3 — Paused vs Blocked** | `isBlocked` flag, `PATCH /:id/blocked`, badges, Attention Zone item, blocked-age metric across its 5 consumers | Phase 2 (working-day age) |
| **4 — Quality / rework** | Derived metrics in `getProgressReport`, fill the existing Quality block, rework badges | **Nothing — can start any time, in parallel** |
| **5 — Daily-first scope** | `taskScopeService`, `?scope=` param, scope toggles, relabelled metric cards | Phase 1 (scoped view of actionable work) |

Phase 4 is the one to hand to a second developer on day one if you have one: no migration, no
dependencies, works retroactively on existing data, and the UI slot is already rendered.
