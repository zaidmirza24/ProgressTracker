# Product Gap Solutions — Implementation Plan

*Companion to `docs/product-gap-analysis.md`. Written 2026-08-16 against `feat/workflow-capacity-signals`.
No code has been changed. This document is intended to be complete enough that a developer can
implement from it without re-deriving the requirements.*

---

## The one architectural insight that shapes everything below

**Capacity, overdue counts, the Attention Zone, and the 7-day forecast are all pure client-side
derivations of `useManagerDashboardStore.tasks`.** `getEmployeeCapacity` / `getPlannedHoursForDay`
in `Frontend/src/lib/taskHelpers.js` take the task array and compute everything on the fly.

That means: **one optimistic patch to the tasks array recalculates the entire insight layer
instantly** — capacity bars, over-capacity flags, forecast cells, attention counts — with no
refetch, no websockets, and no new state plumbing.

The existing `useTaskStatusMutation` hook already proves the pattern. Gap 6 ("Insight → Action")
is therefore not an architecture project. It is *one more mutation hook* plus *one shared action
menu*. Everything else is wiring.

A second, smaller finding worth knowing before you start: `TeamSignalsPanel.jsx:127` already
renders a **Quality** signal block containing only "Avg Resolution" (a time metric, not a quality
one). Gap 4's UI slot exists and is waiting to be filled.

---

# GAP 1 — Task Mutation

## 1.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| Routes | `Backend/routes/taskRoutes.js` | `GET /`, `GET /daily`, `GET /report`, `POST /`, `PUT /:id/status`, `POST /:id/comments`. **No PATCH. No DELETE.** |
| Controller | `Backend/controllers/taskController.js` | `createTask`, `updateTaskStatus`, `addComment`, and crucially `hasTaskAccess(req, task)` — the authorization helper added in Iteration 14, which already implements exactly the scope rule a PATCH needs. Reuse it; do not write a second one. |
| Model | `Backend/models/Task.js` | `isActive: Boolean` exists and is filtered on in every query — **and is never set to `false` anywhere in the codebase.** `history: [{ fromStatus (required), toStatus (required), changedBy, comment, timestamp }]`. |
| Frontend — mutation pattern | `Frontend/src/hooks/useTaskStatusMutation.js` | Optimistic patch → PUT → reconcile → rollback on failure. The template for the new hook. |
| Frontend — surfaces | `ManagerTaskDetailModal` → `TaskDetailModalCore` + `ApprovalGatingPanel`; `TeamTasksTable` (inline status dropdown); `TeamWorkloadTracker` (cards, "+" assign button); `PendingReviewQueue` | Where actions must appear |
| Frontend — form fields | `components/tasks/TaskFormFields.jsx` (`CategorySelect`, `PrioritySelect`, `HoursAndDueDateRow`), `dashboards/manager/CreateTaskModal.jsx` (assignee select + capacity-warning banner) | Reusable; do not rebuild |

**Business rules that must not break:**
- Locked §4 — once Completed, status and historical time logs are **locked**; comments may still be appended.
- Core Rule 2 — soft-delete only (`isActive: false`), never hard-delete.
- Locked §2 — individual work sessions are **retained per task, never discarded**.
- Locked §3 — the 5-state workflow and its transition table are locked.
- `createTask` explicitly destructures its fields (mass-assignment protection). Keep that style.

## 1.2 Root cause

The app was built iteration by iteration around the **workflow** — Iteration 3 added create +
status transitions, and every iteration after that added *signals* rather than *operations*. No
one ever needed a general edit path, so the only mutation verbs in the system are "advance the
status" and "add a comment". `isActive` was designed in from day one and simply never wired to a
caller.

## 1.3 Recommended solution

**One `PATCH /api/tasks/:id` for field edits, one `DELETE /api/tasks/:id` for soft-delete cancel,
and widen the existing `history` array to record field changes.**

Why widen `history` rather than add a `TaskAudit` collection: the audit trail already exists,
the task-detail modal already renders it as a timeline, and a second collection means a second
query on every detail view for ten users' worth of data. Make `fromStatus`/`toStatus` optional
and add an optional `changes: [{ field, from, to }]` array. Existing documents are untouched and
still valid — **no data migration**.

```js
// Backend/models/Task.js — history sub-schema, revised
history: [{
  fromStatus: { type: String },              // was required — now optional
  toStatus:   { type: String },              // was required — now optional
  changes:    [{ field: String, from: String, to: String }],  // NEW: field edits
  changedBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  comment:    { type: String, default: "" },
  timestamp:  { type: Date, default: Date.now }
}]
```

One history entry per mutation. A status change writes `fromStatus`/`toStatus` as today; a field
edit writes `changes`. A reassignment writes `changes: [{ field: "assignedTo", from: "Priya", to: "Arjun" }]`
— store display names, not raw ObjectIds, so the timeline renders without extra populates.

**Cancel** = `isActive: false` + a history entry carrying the reason. No new `cancelledAt` /
`cancelledBy` fields — `history` already answers who and when, and adding parallel fields creates
two sources of truth (§8).

### Interaction with daily-task provisioning — verified, no changes needed

`provisionDailyTasksForEmployee` checks existence with
`Task.findOne({ assignedTo, templateRef, dailyDate: {today} })` — **it does not filter on
`isActive`**. So a cancelled daily task is *not* regenerated the same day (correct), and *is*
regenerated tomorrow (correct — it's a recurring task). The carry-forward query *does* filter
`isActive: true`, so a cancelled incomplete daily won't carry forward (correct). All three
behaviours fall out for free. **Do not "fix" the missing `isActive` filter in the existence
check** — it is load-bearing.

## 1.4 User experience

**Manager corrects a task**
Opens the task (any surface) → detail modal shows an "Edit task" button in a new admin panel
→ same form as Create, pre-filled → changes the estimate from 2h to 5h → Save → modal updates,
the row updates, **and the assignee's capacity bar and the Attention Zone recount immediately**
because the store was patched.

**Manager fixes an overload** (this is the flow the whole product has been missing)
Attention Zone: "1 employee over capacity today" → clicks → workload card expands to show
*the tasks causing it*, biggest estimate first → "Move to tomorrow" on a 3h task → the bar drops
from 11h/7h red to 8h/7h → still over → "Reassign" on another → picks a colleague with
headroom (their remaining hours are shown in the picker) → both bars update → the Attention
Zone flag clears. No page reload, no navigation.

**Manager cancels a task**
Detail modal → "Cancel task" → confirmation dialog naming the task, requiring a reason,
and warning if a timer is currently running on it → task disappears from all lists, its tracked
time is preserved, and the cancellation is in the audit log.

## 1.5 Backend design

### `PATCH /api/tasks/:id`

**Editable fields:** `title`, `description`, `category`, `priority`, `estimatedHours`, `dueDate`,
`assignedTo`, `department`. Nothing else — destructure explicitly.

**Authorization** (extend `hasTaskAccess`, do not replace it):

| Caller | Allowed |
|---|---|
| `super_admin` | all fields, any task in the org |
| `manager` | all fields, tasks within `hasTaskAccess` scope |
| `employee` | `title`, `description`, `priority`, `estimatedHours`, `dueDate` — **only on tasks they created themselves** (`assignedBy === assignedTo === req.user.id`) and only while not Completed. Never `assignedTo`. |

Attempting a forbidden field returns `403` with `code: "FIELD_NOT_EDITABLE"`; don't silently drop it.

**Validation:**
- `title` — non-empty after trim, ≤ 200 chars
- `estimatedHours` — number, `0 ≤ h ≤ 100`. Reject `NaN` and negatives (currently `createTask` accepts both).
- `dueDate` — parseable date or `null`. A past date is **allowed** (backfilling is legitimate) but returns a `warning` field in the response so the UI can surface it.
- `assignedTo` — must be an existing, `isActive: true` user inside the caller's scope. Reassigning outside a manager's direct reports → `403`.
- `priority` — enum; `category` — trimmed string.

**Guard rails:**
- Task Completed → `409 { code: "TASK_LOCKED" }` (Locked §4). Comments remain allowed via the existing endpoint.
- Task `isActive: false` → `404`, matching existing behaviour.
- Concurrency (§29): accept an `updatedAt` from the client and reject a stale write with
  `409 { code: "TASK_MODIFIED" }`. Two managers editing the same task is realistic; last-write-wins
  silently losing an estimate change is not acceptable in a system whose metrics depend on estimates.

**Reassignment side effects** — the important one:

If the task has a running `WorkSession` for the *outgoing* assignee, the controller must stop it
server-side using the exact logic already in `updateTaskStatus` (compute elapsed → `totalSeconds`
→ `stoppedAt`), and flip status `In Progress → Pending`. **Never delete the session** (Locked §2).
Do this in the same request, not as a follow-up.

Consequence to be explicit about: tracked time lives on the *task*, so the new assignee inherits
the previous assignee's hours. That is correct for the task's estimated-vs-actual, but it means
"who spent the time" is only recoverable from `WorkSession.employee`. Add to the task detail
modal: when a task's sessions span more than one employee, show a per-person breakdown line
("2.5h by Priya before reassignment · 1.0h by Arjun"). One extra aggregation on the single-task
path only — do not add it to the list path.

### `DELETE /api/tasks/:id`

- Sets `isActive: false`, pushes a history entry with the required reason.
- `manager` / `super_admin` only, within `hasTaskAccess` scope. Employees may cancel only their
  own self-created, not-yet-started tasks.
- **Refuse to cancel a Completed task** → `409`. Completed work is part of the historical record.
- If a timer is running on it, stop the session first (same helper as above).
- Never hard-delete; never touch `WorkSession` documents.

### Service extraction

`updateTaskStatus`, `PATCH`, and `DELETE` all need "stop the running session for this task".
Extract that into `Backend/services/taskService.js` as `stopRunningSessionForTask(taskId, actorId, reason)`
and call it from all three (§27 — one source of truth). This is the only new service file gap 1 needs.

## 1.6 Frontend design

**Generalise the manager's `CreateTaskModal` into `TaskFormModal` with a `mode: "create" | "edit"` prop.**

`docs/ai/decisions.md` §9 records a deliberate choice *not* to merge the Manager and Employee
create modals, because they genuinely diverge. This is the opposite case: create and edit take
the identical field set, and the capacity-warning banner needs one subtle difference in edit mode
— it must **exclude the task's own current hours** from the assignee's planned total before adding
the new value, or every edit will look like it doubles the load. Duplicating that logic into a
second modal is how it silently drifts. Generalise.

**New component: `components/tasks/TaskAdminPanel.jsx`** — sits alongside `ApprovalGatingPanel`
in `ManagerTaskDetailModal`, following the same self-gating convention (the component decides
whether it has anything to render; the shell doesn't branch). Contains Edit / Reassign / Cancel,
hidden entirely when the task is Completed.

**New component: `components/tasks/TaskActionMenu.jsx`** — a `dropdown-menu` (the primitive already
exists in `components/ui/`) rendered on kanban cards, list rows, team-table rows, and workload-card
task lines. Contents gated by role and status. This is the single surface that makes actions
available *wherever a problem is discovered*, which is the whole point of gap 6.

**New hook: `hooks/useTaskMutation.js`** — a direct sibling of `useTaskStatusMutation`, same
optimistic shape:

```
patch tasks array → PATCH request → reconcile with server response → rollback + toast on failure
```

Because capacity is derived from that array, the recalculation is free.

**States:**
- Confirmation dialog for Cancel (reason required). Reuse the shadcn `Dialog` — do **not** use
  native `confirm()`; the audit doc already flagged the one remaining instance as debt.
- Saving state on the form's submit button; fields stay populated on error (§18).
- `409 TASK_MODIFIED` → "This task was changed by someone else. Reload to see the latest." with a
  reload action. Never silently overwrite.
- Toast on success naming what changed ("Moved to Aug 17" / "Reassigned to Arjun").

## 1.7 Metrics / reporting impact

| Metric | Impact | Required handling |
|---|---|---|
| Capacity / planned hours | Recomputes instantly (client-side derivation) | None — free |
| Estimated vs actual / overrun | Editing an estimate retroactively changes overrun on a task that may already be flagged | Acceptable and correct. But **block estimate edits on Completed tasks** (already blocked by the Completed lock) so historical accuracy can't be rewritten after the fact |
| Estimation accuracy & overrun pattern | Both read completed+estimated tasks only, so edits to open tasks don't corrupt history | None |
| Completion rates | Cancelled tasks vanish from the denominator (`isActive: true` filter) | Correct — a cancelled task shouldn't count as incomplete. Worth one line of UI copy in reports noting cancelled work is excluded |
| Tracked time | Preserved across reassignment and cancellation | Add the per-person breakdown described above |
| Overdue | A rescheduled task stops being overdue immediately | Correct and intended |

## 1.8 Edge cases

| Case | Behaviour |
|---|---|
| Edit a Completed task | `409 TASK_LOCKED`. Comments still allowed. |
| Reassign with a running timer | Stop session server-side, keep the time, status → Pending, log to history |
| Reassign to an inactive user | `400` |
| Reassign a **daily** task | Block it. Daily tasks are template-derived and belong to one employee by construction; reassigning would orphan them from the provisioning cycle. Return `400 { code: "DAILY_TASK_NOT_REASSIGNABLE" }` and hide the action in the UI |
| Cancel a daily task | Allowed. Today's instance goes; tomorrow's regenerates (verified above). To stop it permanently, deactivate the template |
| Due date moved to the past | Allowed, with a warning in the response and the UI |
| Estimate raised past remaining capacity | Allowed, with the existing capacity-warning banner — never blocked (Locked §6 says flag, not prevent) |
| Two managers edit simultaneously | `409 TASK_MODIFIED` via the `updatedAt` check |
| Employee edits a manager-assigned task | `403` |
| Cancel a task in In Review | Allowed (manager), with the pending-review queue updating optimistically |

## 1.9 Migration / backward compatibility

**None required.** Relaxing `required` on `fromStatus`/`toStatus` is permissive — existing history
documents remain valid. `changes` is a new optional array. `isActive: false` is already handled by
every existing query. No backfill, no script.

---

# GAP 2 — Working Days, Holidays, Absence

## 2.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| Cron | `Backend/index.js:60` | `cron.schedule("0 0 * * *", …)` — fires **every calendar day**, timezone from `DAILY_TASK_CRON_TZ` (default `Asia/Kolkata`) |
| Provisioning | `Backend/services/dailyTaskService.js` | `provisionDailyTasksForEmployee` / `…ForAllEmployees`. No calendar awareness |
| Capacity source data | `Backend/models/User.js` | `dailyWorkingHours` (8), `breakHours` (1) |
| Capacity math — frontend | `Frontend/src/lib/taskHelpers.js` | `getEmployeeCapacity`, `getPlannedHoursForDay`, `getCapacityForecast` |
| Capacity math — backend | `Backend/controllers/taskController.js:~420` | **The same formula, implemented a second time** inside `getProgressReport` (`capacityHours = (dailyWorkingHours ?? 8) − (breakHours ?? 1)`) |
| UI | `TeamWorkloadTracker`, `TeamCapacityForecast`, manager `CreateTaskModal` banner, `OrganizationPage` (tabbed) | Where the calendar must show up |

⚠️ **Pre-existing §27 violation to fix as part of this work:** the capacity formula lives in two
places. A working-days change applied to only one of them produces a dashboard and a report that
disagree. Both must move to a shared definition in this iteration.

**Business rules that must not break:** Locked §6 — V1 is single-day capacity planning; daily
capacity = working hours − breaks; remaining capacity is driven by remaining *estimates*, not by
time already logged.

## 2.2 Root cause

V1 defined capacity as a property of *a person*, not of *a person on a given date*. The cron added
in Iteration 13 was built for reliability ("tasks should exist before anyone logs in"), not for
calendar correctness, so it inherited the same day-agnostic assumption.

## 2.3 Recommended solution

Two small models and one service. No scheduling engine, no per-department calendars (speculative
for a single ten-person office), no recurrence rules.

### `Backend/models/OrgSettings.js` — singleton

```js
{
  workingDays: { type: [Number], default: [1,2,3,4,5] },   // 0=Sun … 6=Sat
  holidays: [{ date: Date, name: String }],
  timezone: { type: String, default: "Asia/Kolkata" }       // replaces the loose env var
}
```
Enforce a single document (fixed `_id`, or `findOneAndUpdate(..., { upsert: true })`). Cache it
in memory in the calendar service and invalidate on write — it changes a few times a year.

### `Backend/models/Absence.js`

```js
{
  employee: { type: ObjectId, ref: "User", required: true },
  startDate: { type: Date, required: true },      // inclusive, normalised to start-of-day
  endDate:   { type: Date, required: true },      // inclusive, normalised to start-of-day
  type: { type: String, enum: ["leave","sick","holiday","half_day"], default: "leave" },
  reason: { type: String, default: "" },
  createdBy: { type: ObjectId, ref: "User", required: true },
  isActive: { type: Boolean, default: true }      // soft-delete, per Core Rule 2
}
// index: { employee: 1, startDate: 1, endDate: 1 }
```

A date range, not a per-day flag: it's how leave is actually requested, it's one document per
absence, and a day lookup is a single indexed query.

### `Backend/services/calendarService.js` — the single source of truth

```js
isWorkingDay(date, settings)                      // weekday ∈ workingDays && not a holiday
getAbsenceForDay(employeeId, date, absences)      // null | absence doc
getCapacityHoursForDay(employee, date, settings, absences)
   // 0 if non-working day or full-day absence
   // (dailyWorkingHours − breakHours) × 0.5 if half_day
   // (dailyWorkingHours − breakHours) otherwise
workingDaysBetween(from, to, settings)            // for age metrics
```

`getProgressReport` calls it directly. **`getPlannedHoursForDay` stays where it is** — planned
hours are still just the sum of remaining estimates; only the *capacity* side becomes
calendar-aware.

### Frontend gets the same rule, not a reimplementation

New endpoint `GET /api/calendar/context` returning `{ workingDays, holidays, absences }` for the
relevant window (absences scoped by role, same pattern as every other endpoint). The manager
dashboard already issues five parallel GETs; this is a sixth, cheap one. `getEmployeeCapacity`
takes an optional `calendar` argument and returns `capacityHours: 0` with a `reason` of
`"weekend" | "holiday" | "leave" | "half_day"` — the frontend must keep computing locally so that
optimistic edits still recalculate instantly, but both sides now apply the identical rule.

### Cron and provisioning

- The cron job checks `isWorkingDay(today)` and returns early on weekends and holidays.
- `provisionDailyTasksForEmployee` skips employees who are absent that day.
- `ensureDailyTasks` (the login self-heal) applies the identical check — otherwise logging in on
  a Saturday would recreate exactly what the cron correctly skipped.

Carry-forward across a weekend needs **no special handling**: provisioning simply doesn't run, so
Friday's incomplete task keeps `dailyDate: Friday` and is re-stamped Monday by the existing
carry-forward loop. Verify this in testing rather than adding code for it.

### Working-day-aware age metrics

Use `workingDaysBetween` for pending/blocked age (gap 3). **Leave `isTaskOverdue` unchanged** — a
due date that passes on Saturday is genuinely still overdue on Monday, and Locked §8 makes overdue
a signal rather than a penalty. Making overdue calendar-aware adds complexity for no decision value.

## 2.4 User experience

**Admin** — `OrganizationPage` gains a fifth tab, **Work Calendar**: seven weekday checkboxes and a
simple holiday list (date + name, add/remove). No new route; the page is already tabbed.

**Manager** — an "Mark as away" action on the `TeamWorkloadTracker` card, because the manager is
who notices. Opens a small dialog: employee, date range, type, optional reason. The admin can do
the same from the Users tab.

**Everywhere capacity is shown:**
- Weekend/holiday → the capacity bar is replaced by a muted "Non-working day" line, not a 0/7h bar
  that reads like a failure.
- On leave → "On leave until Aug 20" with a neutral badge (never a warning colour — absence is not
  a problem).
- The forecast grid greys non-working columns and marks leave days distinctly from
  under-capacity ones. Today's `TeamCapacityForecast` shades by planned/capacity ratio; a
  zero-capacity day must not render as catastrophic red.
- The create/edit capacity banner: "Arjun is on leave on Aug 18 — this task's due date falls on a
  non-working day." Warn, never block.

## 2.5 Backend design

**New routes** (`Backend/routes/calendarRoutes.js`, mounted at `/api/calendar`):

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/context` | any authenticated | absences scoped: employee → own; manager → direct reports; admin → all |
| `GET`/`PUT` | `/settings` | read: any; write: `super_admin` | the singleton |
| `GET`/`POST` | `/absences` | read: scoped; create: `manager` (own reports) + `super_admin` | |
| `DELETE` | `/absences/:id` | `manager` (own reports) + `super_admin` | soft-delete (`isActive: false`) |

**Validation:** `endDate >= startDate`; range ≤ 90 days (a typo'd year shouldn't zero someone's
capacity for a decade); overlapping active absences for the same employee → `409`; normalise both
dates to start-of-day in the org timezone before storing (§25 — this is exactly where timezone
bugs live).

**Audit:** `createdBy` on every absence; soft-delete rather than removal, so a report run over a
past period still explains why capacity was zero.

## 2.6 Frontend design

- `OrganizationPage` → new **Work Calendar** tab (reuse `DepartmentsTab`'s list/dialog structure).
- New `components/dashboards/manager/AbsenceDialog.jsx`, opened from the workload card menu.
- `useOrgStore` gains `calendarSettings` / `absences` + fetchers; `useManagerDashboardStore.loadData`
  adds the `/api/calendar/context` call to its existing `Promise.all`.
- `getEmployeeCapacity(employee, tasks, extraHours, day, calendar)` — new optional last argument,
  so every existing call site keeps working during the rollout.

## 2.7 Metrics / reporting impact

| Metric | Change |
|---|---|
| `capacityHoursToday` | 0 on non-working days / full absence; halved on half-days |
| `plannedUtilizationPct` / `actualUtilizationPct` | **Division-by-zero risk.** Current code guards `capacityHours > 0` and returns 0 — that now means "0% utilised" on a Sunday, which reads as idleness. Return `null` and render "—" instead |
| `isCapacityOverrunToday` | Must be `false` on non-working days, or anyone who does 20 minutes on a Saturday is flagged as over capacity |
| Daily completion rate | Weekend daily tasks stop being generated, so the denominator stops being inflated. **Existing weekend tasks in the DB will keep skewing historical rates** — see migration |
| Carry-forward counts | Drop substantially; Monday no longer shows two weekend instances |
| Pending/blocked age | Measured in working days (gap 3) |
| Overdue | Unchanged, deliberately |

## 2.8 Edge cases

| Case | Behaviour |
|---|---|
| Leave starts while a timer is running | Do not auto-stop; absence is a planning construct, not an enforcement one. Capacity for that day is zero and any tracked time shows as unplanned work — which is exactly the signal a manager wants |
| Task due on a day the assignee is on leave | Allowed, warned at create/edit time |
| Half-day | Capacity × 0.5. Do not model morning/afternoon — no feature needs the distinction |
| Absence cancelled retroactively | Soft-delete; capacity recomputes from live data on the next report |
| Holiday added retroactively | Past reports change. Acceptable and correct; note it in the UI copy |
| Employee with `dailyWorkingHours: 0` | Capacity 0 every day; treat identically to a non-working day |
| All seven days configured as working | Legal (shift work); nothing special |
| Cron misses midnight (server down) | Login self-heal still covers it — but the self-heal must apply the same calendar check |

## 2.9 Migration / backward compatibility

**One optional cleanup, and it is a judgement call:**

Daily tasks already provisioned on past weekends exist in the database and will keep skewing
historical daily-completion and carry-forward numbers. Two honest options:

1. **Leave them.** History is history; the numbers were computed from real records. Simplest, and
   the distortion decays as new correct data accumulates.
2. **Soft-delete** (`isActive: false`) never-started (`Not Started`, zero tracked time) daily tasks
   that fall on days that are non-working under the new settings, via a one-off script.

**Recommendation: option 2, restricted exactly as stated** — never touch a task with any tracked
time or any status beyond `Not Started`, and log every affected ID before writing. Weekend noise
is pure provisioning artefact, and leaving it means the first month of the new working-days
feature is judged against a polluted baseline. Run it as a reviewable script, not an automatic
migration.

`OrgSettings` needs a seeded default document — create it lazily via upsert on first read so no
migration step is required.

---

# GAP 3 — Paused vs Blocked

## 3.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| The mechanism | `Backend/controllers/workSessionController.js:47` — `setTaskStatus` | Flips `In Progress → Pending` on **pause, stop, and task-switch**, and back on resume |
| Workflow | `Backend/config/workflow.js` | `Pending` appears in both employee maps; `In Progress ↔ Pending` both ways |
| The metric | `taskController.getPendingAgeDays` | Measures from the last history transition **into** `Pending` |
| Stepper | `Frontend/src/lib/stepper.js` | `normalizeForStepper` maps `Pending → In Progress` — the UI *already* treats Pending as a paused sub-state |
| Kanban | `TaskKanbanBoard.jsx` | Renders `Pending` as its own column, contradicting the stepper's treatment |
| Consumers of the age metric | `TeamSignalsPanel`, `EmployeeDrilldownModal`, `MyProgressSection`, `MyProgress`, `buildEmployeeSignalSummary` | **Five** — all must be updated together (§30) |

## 3.2 Root cause

Iteration 6 needed a state meaning "work started but the timer isn't running" and reused the
locked workflow's `Pending`. Iteration 9 then built the pending-backlog-age signal on top of it,
assuming `Pending` meant *waiting on something* — the locked doc's meaning — when the code had
made it mean *timer off*. The metric has been measuring evenings and weekends ever since.

## 3.3 Recommended solution

**Do not add a sixth status.** Add a `blocked` flag that is *orthogonal* to status.

Status answers **"where is this in the workflow?"**. Blocked answers **"can it proceed?"**. Those
are different questions, and merging them is precisely what created this bug. An orthogonal flag
also means **zero changes** to `WORKFLOW_RULES`, `isValidTransition`, the stepper, or the locked
5-state guarantee — which matters, because that workflow is a locked product decision.

```js
// Backend/models/Task.js — new fields
isBlocked:     { type: Boolean, default: false },
blockedReason: { type: String, default: "" },
blockedAt:     { type: Date, default: null },
blockedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
// index: { isBlocked: 1, isActive: 1 }
```

Then split the two meanings in the reporting layer:

- **Paused** = `status === "Pending"` — a count only. Never an age metric, because the age is
  meaningless (it's mostly overnight).
- **Blocked backlog** = `isBlocked === true`, aged from `blockedAt` **in working days**
  (`calendarService.workingDaysBetween`). *This* is the pending-backlog signal Locked §8 actually
  described.

### ⚠️ One decision needs your sign-off

I recommend **relabelling the `Pending` status to "Paused" in the UI only** — the enum value stays
`"Pending"`, so there is no migration and no workflow change.

The reasoning: the locked doc's §8 describes Pending as *"pending backlog, including how long each
task has sat pending"* — i.e. waiting work. The implementation made it mean *timer off*. So the
code is what deviated from the locked intent, and relabelling restores it. But the locked document
does name the state "Pending", so per `CLAUDE.md` this is flagged rather than done silently.
If you'd rather keep the "Pending" label, everything else in this plan still works — the metric
just gets reported as "Blocked backlog" alongside a "Paused" count.

## 3.4 User experience

**Employee is stuck**
Task detail modal, below the timer panel: **"Mark as blocked"** → small inline form requiring a
reason ("Waiting on API credentials from IT") → task shows a red **Blocked** badge everywhere it
appears, with the reason on hover → it leaves their "what can I work on now" mental list without
leaving their workload.

**Employee is unstuck**
One click on "Unblock", *or* automatically when they start the timer again — if work is
demonstrably proceeding, the task isn't blocked. Auto-clear is written to history so the manager
can see the block resolved itself.

**Manager**
A new Attention Zone item: **"2 tasks blocked"** — likely the highest-value signal in the whole
zone, because a blocked task is the one problem a manager can usually fix immediately. Clicking
shows the blocked tasks with their reasons and a comment box. The workload card shows
"3.5h of planned work is blocked" beneath the capacity bar.

## 3.5 Backend design

**New route:** `PATCH /api/tasks/:id/blocked` with `{ isBlocked, reason }`.

Separate from the general `PATCH` because it has different authorization (the *assignee* should be
able to block their own task even though they can't edit its other fields) and different validation
(reason required to block, forbidden to unblock).

- Auth: assignee, or manager/admin within `hasTaskAccess` scope.
- Blocking requires a non-empty `reason` (≤ 300 chars). Unblocking clears `blockedReason` and sets
  `blockedAt: null`, and writes the resolution to history.
- Every block/unblock appends a history entry (`changes: [{ field: "isBlocked", … }]`, comment = reason).
- Reject blocking a `Completed` task → `409`.
- `workSessionController.startSession` and `resumeSession` auto-clear the flag when set, logging it.

**Report changes** in `getProgressReport`:
```
pausedCount               // status === "Pending"      (count only, no age)
blockedCount              // isBlocked === true
blockedBacklogAvgAgeDays  // working days since blockedAt
blockedBacklogOldestAgeDays
blockedTasks: [{ _id, title, reason, ageDays }]   // traceability, per Locked §12
```
Keep `pendingBacklogAvgAgeDays` in the response for one release, set to the new blocked-based
value, so nothing breaks mid-rollout — then remove it once all five consumers are updated.

## 3.6 Frontend design

- **Block/unblock control** in `TaskTimerPanel` (employee) and `TaskAdminPanel` (manager).
- **Blocked badge** in the same slot as the existing overrun badge — `TaskListView`,
  `TaskKanbanBoard`, `DailyTasksSection`, `TeamTasksTable`, `TeamWorkloadTracker`,
  `TaskDetailModalCore`. Follow the Iteration 13 carry-forward-badge rollout as the checklist of
  places a task-level badge must appear.
- **Kanban:** keep the five columns, but render blocked cards with a red left border in whichever
  column they sit. Blocked is not a stage, so it must not become a column.
- **Attention Zone:** new blocked item, `destructive` tone.
- Do **not** add a "Blocked" step to the stepper — it's orthogonal, and the stepper shows workflow position.

## 3.7 Metrics / reporting impact

| Metric | Before | After |
|---|---|---|
| Pending backlog age | Measured evenings and weekends; systematically misleading | Split: paused = count only; blocked = aged in working days from an explicit marker |
| `buildEmployeeSignalSummary` | "pending work is aging significantly (2.4 days)" for someone who just went home | Reports blocked work honestly; says nothing alarming about merely-paused tasks |
| Capacity | Unchanged — blocked work is still work that must be done, so it stays in planned hours | Add a "of which X h blocked" line so the manager sees why the plan won't be met |
| Overdue | Unchanged | A blocked+overdue task should sort to the top of the manager's attention list |

## 3.8 Edge cases

| Case | Behaviour |
|---|---|
| Blocked task's timer is started | Auto-unblock, logged to history |
| Task blocked, then Completed anyway | Clear the flag on completion; keep the history |
| Blocked multiple times | Each block/unblock pair is a history entry; age measures from the *current* `blockedAt` only. Repeat blocking is visible in the timeline (a pattern signal for later, not now) |
| Blocked while In Review | Allowed — a review can be blocked on the reviewer |
| Blocked across a weekend | Working-day age, so it doesn't inflate |
| Blocked task reassigned | Flag and reason carry over; add a history note |
| Blocked daily task | Allowed, and it carries forward normally |
| Manager blocks on the employee's behalf | Allowed; `blockedBy` records who |

## 3.9 Migration / backward compatibility

**No data migration.** New fields default to `false`/`null`; every existing task reads as unblocked,
which is accurate — nobody has been able to declare a block until now.

Historical `pendingBacklogAvgAgeDays` values in past reports were computed live and were never
stored, so nothing needs correcting. The interpretation changes going forward, which is the point.

---

# GAP 4 — Quality / Rework

## 4.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| The action | `ApprovalGatingPanel.jsx` ("Send for Rework"), `PendingReviewQueue.jsx` (inline "Rework") | Both call `updateTaskStatus(id, "In Progress", feedback)`, feedback required |
| The record | `Task.history` | `{ fromStatus: "In Review", toStatus: "In Progress", changedBy, comment }` — **already stored, on every rework, historically** |
| The workflow | `Backend/config/workflow.js` | `manager["In Review"] = ["Completed", "In Progress"]`; employees have **no** `In Review` key at all |
| The gap | `getProgressReport` | Never reads it. No rework metric exists anywhere |
| The waiting UI slot | `TeamSignalsPanel.jsx:127` | A **"Quality" SignalBlock** containing only "Avg Resolution" |

## 4.2 Root cause

Iterations 7–10 implemented the locked doc's signals in order and stopped at pattern detection.
Quality was the one signal with no derivation written. The rework *action* was built in Iteration 6
as part of the workflow, well before the signals layer existed, so the two were never connected.

## 4.3 Recommended solution

**Derive it from `task.history` inside the existing report loop. Store nothing new.**

The decisive property: because employees are structurally incapable of moving a task out of
`In Review` (the role has no such transition in `WORKFLOW_RULES`), **every `In Review → In Progress`
history entry is by definition a manager-initiated rework.** No role lookup, no populate, no new
field. And it works retroactively across every task already in the database.

```js
// Backend/controllers/taskController.js — new helpers alongside computeOverrunFields

const QUALITY_MIN_SAMPLE = 3   // mirror PATTERN_MIN_SAMPLE's small-sample discipline

const getReworkCount = (task) =>
  (task.history || []).filter(h => h.fromStatus === "In Review" && h.toStatus === "In Progress").length

const wasEverReviewed = (task) =>
  (task.history || []).some(h => h.toStatus === "In Review")
```

**Definitions — write these into the UI, not just the code (§14):**

| Metric | Definition |
|---|---|
| `reworkCount` (task) | Times a manager returned it from In Review |
| `reviewedTaskCount` (employee) | Completed tasks that **ever entered In Review** |
| `firstPassApprovalRate` | Completed reviewed tasks with `reworkCount === 0` ÷ `reviewedTaskCount` |
| `reworkRate` | Completed reviewed tasks with `reworkCount ≥ 1` ÷ `reviewedTaskCount` |
| `hasQualitySignal` | `reviewedTaskCount >= QUALITY_MIN_SAMPLE && reworkRate > 0.5` |
| `reworkedTasks` | `[{ _id, title, reworkCount, lastFeedback }]` — traceability, per Locked §10/§12 |

**The denominator is the critical detail.** It must be *reviewed* tasks, not all tasks. Daily and
self-assigned tasks skip review entirely by design, so including them would drown the rate and
report a permanent ~100% first-pass rate for everyone. Label it explicitly in the UI:
*"First-pass approval: 71% — 5 of 7 reviewed tasks approved without rework."*

Also expose per-task `reworkCount` from `attachTrackedSecondsToTasks` and `getTaskWithTime` so a
rework badge can render on rows — history is already populated on those paths, so it costs nothing.

## 4.4 User experience

**Manager, at a glance** — the existing Quality block in `TeamSignalsPanel` fills out:
```
QUALITY
First-pass approval    71%
Rework rate            29%   (2 of 7 reviewed)
Avg resolution         3.2d
```
Expanding shows *which* tasks were reworked and the feedback given — so a quality flag is always
traceable to specific work, never a bare percentage.

**Manager, on a task row** — a small "Reworked ×2" badge, in the same slot as the overrun badge.
Reviewing a task that has already bounced twice is a materially different decision from reviewing
a fresh submission, and right now the queue gives no hint.

**Employee** — visible on their own `MyProgress` page, in the same non-punitive register the app
already uses: *"5 of your 7 reviewed tasks were approved first time. Rework usually points at
unclear requirements as often as at the work itself."* Never a ranking, never a score.

## 4.5 Backend design

- **No model change. No new endpoint. No migration.** One helper pair plus additions to the
  per-employee object in `getProgressReport`.
- `getProgressReport` currently uses `.lean()` without populating `history.changedBy` — it doesn't
  need to, since the role check is unnecessary. Keep it that way; don't add a populate.
- Performance: `history` is already loaded on those documents; this is an in-memory filter over an
  array of a handful of entries per task. Negligible.
- Small-sample guard mirrors the existing pattern detector — do not flag an employee whose entire
  history is two reviewed tasks.

## 4.6 Frontend design

| Component | Change |
|---|---|
| `TeamSignalsPanel.jsx` | Fill the existing Quality block; flag when `hasQualitySignal` |
| `EmployeeDrilldownModal.jsx` | New Quality section with the reworked-task list + feedback |
| `EmployeesReport.jsx` | Optional small "Rework" badge next to the name, matching the existing Pattern badge |
| `PendingReviewQueue.jsx` | "Reworked ×2" badge on cards that have bounced — highest-value single placement |
| `TeamTasksTable`, `TaskDetailModalCore` | Same badge in the overrun-badge slot |
| `MyProgress.jsx` / `MyProgressSection.jsx` | Personal first-pass rate, non-punitively framed |
| `taskFormatters.js` | `formatRework(task)` → `"Reworked ×2"` or `null`, mirroring `formatOverrun`; extend `buildEmployeeSignalSummary` with one quality sentence |

## 4.7 Metrics / reporting impact

Purely additive — no existing metric changes value. One caveat to state in the UI: rework rate is
only meaningful for employees who *do* review-gated work. An employee on mostly daily tasks will
show `reviewedTaskCount: 0` and must render as **"Not applicable"**, never as 0% or 100%.

## 4.8 Edge cases

| Case | Behaviour |
|---|---|
| Employee with zero reviewed tasks | "—" / Not applicable. Never 100% |
| Task reworked 3× then completed | `reworkCount: 3`, counts once against first-pass rate |
| Task reworked and still open | Excluded from the rate (denominator is *completed* reviewed tasks); still shows its badge |
| Manager reopens a **Completed** task | That's `Completed → In Progress`, not `In Review → In Progress` — correctly **not** counted as rework. Consider surfacing it separately later; don't conflate now |
| Rework then reassignment | Rework attaches to the task, so it follows the new assignee. Note this in the drill-down copy |
| Task deleted/cancelled | Excluded via the existing `isActive` filter |
| Very old tasks with sparse history | Handled — `wasEverReviewed` returns false and they leave the denominator |

## 4.9 Migration / backward compatibility

**None. This is the cheapest high-value item in the entire plan** — every metric is computable
today from data already in the database, retroactively, for every employee.

---

# GAP 5 — Daily-First Views / Task Scope

## 5.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| API | `taskController.getTasks` | Returns **every** task the caller can see, all-time, unpaginated, with `comments`, `history`, and four populates |
| Employee | `EmployeeDashboard.jsx` | Board/list over all tasks; metric cards labelled "All-time · every task ever assigned to you"; client-side search only |
| Manager | `TeamTasksTable.jsx` | Same, plus assignee search |
| Reports | `useReportsStore` | The **only** place with a timeframe (`today`/`week`/`month`/`custom`), default `week` |
| Daily section | `DailyTasksSection.jsx` | Correctly today-scoped already (`t.isDaily` + provisioning stamps `dailyDate`) |

Locked §7: *"Primary view is daily."* The primary surfaces are all-time.

## 5.2 Root cause

Built when the seed dataset was ~30 tasks. Every subsequent iteration added a surface on top of
the same unscoped fetch, and no one hit the wall because the demo data never grew. With daily
tasks now auto-provisioning per employee per working day, the task collection grows ~10 rows a day
and the Completed kanban column grows without bound.

## 5.3 Recommended solution

**Server-side `scope` parameter with a precisely-defined "today", plus a visible toggle.** Default
the employee dashboard to `today` and the manager table to `week`.

The critical piece is the definition of "today", because the naive version is actively harmful:

> **A task is in "today" scope if any of:**
> - it is a daily task with `dailyDate` = today; **or**
> - it is not completed and `dueDate <= today` (**includes overdue** — see below); **or**
> - it is not completed and has no `dueDate` but is `In Progress` / `Pending` / `In Review`; **or**
> - it was completed today; **or**
> - it is the employee's currently-timed task.

**A filter of `dueDate === today` would hide every overdue task** — exactly the ones that need
attention — and would silently break the overdue signal on the primary screen. This definition is
the single most important detail in gap 5.

Implement it once, server-side, in `Backend/services/taskScopeService.js` (`buildScopeFilter(scope, date)`),
so employee and manager surfaces cannot drift apart.

`GET /api/tasks?scope=today|week|all` — when omitted, default to `all` so existing callers keep
working during rollout; the frontend always passes it explicitly.

**Payload slimming is a separate, later change.** Dropping `comments`/`history` from the list
response would cut it substantially, but `TaskDetailModalCore` renders both straight off the object
the list handed it, and `PendingReviewQueue` reads `t.comments[last].text`. So it requires adding
`GET /api/tasks/:id` and having the detail modal fetch on open. That is the right architecture, but
it must ship as one unit — **do not slim the payload without adding the detail endpoint.** Keep it P2.

## 5.4 User experience

**Employee** opens their dashboard and sees **today**: today's daily tasks, anything due today,
anything overdue and still open, whatever is in flight. Cards read "Today: 6 tasks · 4 done · 1
overdue" instead of "Assigned Tasks: 143". A `Today | This week | All` toggle sits beside the
existing Board/List switch — same visual pattern, so nothing new to learn. The Completed column
shows today's completions with a quiet "+38 completed earlier" link.

**Manager** gets the same toggle on the Team Tasks page, defaulting to This week, plus URL-driven
filters (`/team-tasks?filter=overdue`) so the Attention Zone can deep-link into a pre-filtered
view — filters are shareable state and belong in the URL (§24).

## 5.5 Backend design

- `getTasks` accepts `scope`, `status`, `assignedTo`, `page`, `limit`.
- Response becomes `{ tasks, total, scope }`. Adding sibling keys is backward-compatible with every
  current consumer, which reads `res.data.tasks`.
- Pagination only kicks in when `limit` is passed — avoids changing behaviour for callers that
  don't opt in.
- The existing index `{ assignedTo: 1, isActive: 1 }` covers the employee path. The scope filter
  adds `dueDate` / `dailyDate` predicates; `{ isActive, status, dueDate }` covers most of it.
  Measure before adding a `dailyDate` index — ten users may never need it.
- Timezone (§25): "today" must be computed in the org timezone from `OrgSettings` (gap 2), not the
  server's locale. Do not use `new Date()` boundaries without normalising.

## 5.6 Frontend design

- Scope toggle beside the existing Board/List switch (`EmployeeDashboard`) and in the
  `TeamTasksTable` header. Persist the choice in the URL, not in local state.
- Metric cards relabel to the active scope; keep the all-time figure available in `MyProgress`.
- Empty states must be scope-aware (§15): "Nothing scheduled for today" is a *good* state and must
  not look like the "no data" error state.
- Stores gain a `scope` field and re-fetch on change; keep already-loaded content visible during
  the re-fetch (§16) rather than dropping to a skeleton.

## 5.7 Metrics / reporting impact

**None on the reports** — `getProgressReport` has its own independent date filtering and is not
touched. The change is confined to the *task list* surfaces. Dashboard metric cards derived from
the (now scoped) array must relabel accordingly, or "Completed Tasks: 4" will read as an all-time
figure and mislead (§41).

## 5.8 Edge cases

| Case | Behaviour |
|---|---|
| Task with no due date | Included in "today" only while active; otherwise visible under All |
| Task completed yesterday | Not in today's scope. Reachable via All and via `MyProgress` |
| Overdue task | **Always** in today's scope — the defining rule |
| Currently-timed task | Always in scope regardless of dates, or the timer widget would reference an invisible task |
| Employee with an empty day | Scope-aware empty state, not an error |
| Manager with 200 team tasks | Week scope + pagination |
| Timezone boundary near midnight | Org timezone from `OrgSettings`, consistently on both sides |

## 5.9 Migration / backward compatibility

**None.** Filtering is additive; omitting `scope` preserves today's exact behaviour.

---

# GAP 6 — Insight → Action

## 6.1 Current implementation

| Layer | Location | What exists |
|---|---|---|
| Manager signals | `AttentionZone.jsx` | Counts for review / overdue / over-capacity / pattern. Overdue **navigates** to `/team-tasks` (unfiltered); the rest **scroll** to an in-page section |
| Employee signals | `NeedsAttentionStrip.jsx` | Overdue + overrun counts, scrolls to the task list |
| Admin signals | `ReportsTab.jsx` | Three attention buttons, all of which just switch the sub-tab |
| Workload | `TeamWorkloadTracker.jsx` | Per-employee capacity bar. **The only action on the card is "+ assign another task"** |
| Forecast | `TeamCapacityForecast.jsx` | Read-only 7-day grid, no actions |
| Mutation pattern | `useTaskStatusMutation.js` | The established optimistic hook |

Every signal terminates in navigation or a scroll. None terminates in a change.

## 6.2 Root cause

Signals were built in Iterations 7–11, and the operations they imply (reassign, reschedule,
re-estimate, cancel) never existed. There was nothing to attach. Gap 6 is not really a separate
gap — it is gap 1 plus wiring.

## 6.3 Recommended solution

Three pieces, no new screens.

**1. `hooks/useTaskMutation.js`** — sibling of `useTaskStatusMutation`, same optimistic
patch→request→reconcile→rollback shape, covering PATCH / DELETE / block-toggle. Because capacity
and every attention count are client-side derivations of the tasks array, patching it optimistically
makes the entire insight layer recalculate in the same frame. This one hook *is* "capacity
recalculates immediately."

**2. `components/tasks/TaskActionMenu.jsx`** — one dropdown (the `dropdown-menu` primitive already
exists), rendered wherever a task appears, contents gated by role and status:

| Role | Actions |
|---|---|
| Manager / admin | View details · Edit · Reassign… · Move to tomorrow · Pick date… · Cancel task |
| Employee (own self-created, not completed) | View details · Edit · Mark blocked / Unblock |
| Employee (manager-assigned) | View details · Mark blocked / Unblock |

**3. Signal-specific quick actions**, each placed where the problem is discovered:

| Signal | Discovered in | Action to add |
|---|---|---|
| Over capacity | `TeamWorkloadTracker` card | Expand to list **the tasks causing the overload**, largest estimate first, each with inline "Move to tomorrow" / "Reassign". Bar updates live |
| Overdue | `AttentionZone` | Navigate to `/team-tasks?filter=overdue` (pre-filtered — currently unfiltered) with row-level Reschedule |
| Blocked (gap 3) | `AttentionZone` | Filtered list showing reasons, with Comment / Unblock |
| Awaiting review | `PendingReviewQueue` | Already actionable. Add the rework badge from gap 4 |
| Overrun | Task badge | "Adjust estimate" in the action menu — the honest response is often that the estimate was wrong |
| Estimation pattern | `TeamSignalsPanel` | Already drills to tasks. Leave alone — the right response is a conversation, not a button |

**Reassign picker detail:** when reassigning, the employee dropdown must show each candidate's
**remaining capacity for that day** ("Arjun — 3.5h free", "Priya — over capacity"). The manager is
choosing precisely on that basis, and `getEmployeeCapacity` already computes it. This is the single
highest-value small touch in gap 6.

## 6.4 User experience

The canonical loop, end to end, on one screen:

```
Attention Zone: "1 employee over capacity today"
   → click
Workload card expands: Priya — 11h planned / 7h capacity
   Tasks driving it:  API integration 4h · Report review 3h · Bug triage 2h · dailies 2h
   → "Move to tomorrow" on Report review
Bar: 8h / 7h  (still over, still red)
   → "Reassign" on Bug triage → picker shows "Arjun — 3.5h free"
Bar: 6h / 7h  → green.  Arjun's card: 5.5h / 7h.  Attention Zone flag clears.
```

No navigation, no reload, no separate planning screen. Every state change is optimistic with
rollback and a toast.

## 6.5 Backend design

**No new endpoints beyond gaps 1–3.** Gap 6 is entirely a frontend composition of the mutation
API that gap 1 introduces. That is the strongest argument for building gap 1 first.

One addition worth making: `PATCH /api/tasks/:id` should accept a **partial** body and return the
fully populated task in the same shape `updateTaskStatus` returns, so the optimistic reconcile
path is identical across both hooks.

## 6.6 Frontend design

- Reuse `AttentionZone`'s existing `AttentionItem` component; give it an optional `filter` prop that
  builds a URL query rather than scrolling.
- `TeamTasksPage` reads `?filter=` from the URL (`useSearchParams`) — overdue / blocked / review /
  employee. Shareable, bookmarkable, back-button-correct (§24).
- Workload card gains an expand/collapse (mirror `TeamSignalsPanel`'s existing row-expansion
  pattern — don't invent a second disclosure idiom).
- Every action: optimistic update → toast → rollback on failure. Destructive actions (cancel) get a
  confirmation dialog; non-destructive, easily-reversible ones (move to tomorrow) do not.
- Loading: disable the individual action, not the whole card.

## 6.7 Metrics / reporting impact

None directly — gap 6 changes *where* mutations are triggered, not what they do. The second-order
effect is the point: managers will actually reschedule and reassign, so capacity, overdue counts
and completion rates will start reflecting decisions rather than only recording drift.

## 6.8 Edge cases

| Case | Behaviour |
|---|---|
| "Move to tomorrow" lands on a weekend/holiday | Skip to the next working day and say so in the toast ("Moved to Mon 18 Aug") — depends on gap 2 |
| Reassign target is on leave that day | Allowed, warned in the picker |
| Reassign target also goes over capacity | Allowed, shown live in the picker — never blocked (Locked §6: flag, don't prevent) |
| Two managers act on the same task | `409 TASK_MODIFIED` → refresh prompt |
| Action on an already-completed task | Menu items hidden *and* server-rejected |
| Optimistic patch fails | Roll back the array; every derived count reverts with it automatically |
| Action on a daily task | Reassign hidden; move/cancel allowed |

## 6.9 Migration / backward compatibility

None.

---

# Prioritization

## P0 — Must fix

| # | Item | Why P0 |
|---|---|---|
| 1 | **Task mutation API + action surfaces** (gaps 1 & 6 core) | The product's central promise is "spot the workload problem, fix it." Half of that does not exist. Everything else in this plan either depends on it or is decoration without it. Ship the API and the action menu together — the API alone changes nothing a user can see |
| 2 | **Working days, holidays, absence** (gap 2) | Corrupts the *input data* every other signal reads. Every weekend inflates carry-forwards, deflates completion, ages backlogs, and reports the whole team as idle. Fixing metrics before fixing this means tuning against a polluted baseline |
| 3 | **Paused vs Blocked** (gap 3) | One of the seven core signals is currently measuring evenings and weekends and reporting it as backlog age. That's an actively misleading metric (§41), and the fix is small. It also gives employees the ability to say "I'm stuck" — the single most useful thing a manager can learn |

## P1 — Important

| # | Item | Why P1 |
|---|---|---|
| 4 | **Quality / rework signal** (gap 4) | Explicitly specified in Locked §9/§11, entirely absent, and computable from data already in the database with zero migration. Only P1 rather than P0 because nothing is currently *wrong* — it's simply missing. Best effort-to-value ratio in the plan; it can run in parallel with P0 items 2 and 3 |
| 5 | **Daily-first scope** (gap 5) | Locked §7 says the primary view is daily and it isn't. Real but not corrupting — and the toggle is far more useful once the P0 actions exist, because a scoped view of *actionable* work is what it's for |
| 6 | **Extended action wiring** (gap 6 remainder) | URL filters, the reassign-picker capacity hints, the expandable workload card. Multiplies the value of P0 item 1 |

## P2 — Later

| # | Item | Why P2 |
|---|---|---|
| 7 | List payload slimming + `GET /api/tasks/:id` | Correct architecture, no user-visible benefit at ten people. Must ship as one unit |
| 8 | Cancelled-task visibility (an "including cancelled" filter) | Only matters once cancelling is common |
| 9 | Employee self-service absence requests | The manager-entered version covers a ten-person office |
| 10 | Week-over-week trend deltas | Genuinely useful; distracting before the core loop closes |
| 11 | Work-log ↔ task integration | Improves a flow that already works |

---

# Final Output

## 1. Recommended architecture changes

Small and additive. Four new backend files, no structural change:

| File | Purpose |
|---|---|
| `Backend/services/taskService.js` | `stopRunningSessionForTask` — shared by status update, PATCH, DELETE (§27) |
| `Backend/services/calendarService.js` | The **single** working-day/capacity/working-day-span authority, used by provisioning, the report, and the new calendar endpoint |
| `Backend/services/taskScopeService.js` | `buildScopeFilter` — one definition of "today" for all surfaces |
| `Backend/routes/calendarRoutes.js` + `controllers/calendarController.js` | Settings and absences |

Frontend: two new hooks/components (`useTaskMutation`, `TaskActionMenu`), one generalised modal
(`TaskFormModal`), two new panels (`TaskAdminPanel`, `AbsenceDialog`), one new admin tab. **No new
routes, no new pages, no new state library.**

Also fix, as part of gap 2: the capacity formula is currently implemented twice (`taskHelpers.js`
and `taskController.js`). Both must derive from one documented rule or the dashboard and the report
will disagree the moment calendars land.

## 2. Database / model changes

| Model | Change | Migration |
|---|---|---|
| `Task` | `history.fromStatus`/`toStatus` → optional; add `history.changes[]` | None (permissive) |
| `Task` | `isBlocked`, `blockedReason`, `blockedAt`, `blockedBy` + index `{isBlocked, isActive}` | None (defaults) |
| `OrgSettings` **(new)** | Singleton: `workingDays`, `holidays[]`, `timezone` | Lazy upsert on first read |
| `Absence` **(new)** | `employee`, `startDate`, `endDate`, `type`, `reason`, `createdBy`, `isActive` + index | None |
| `User`, `WorkSession`, `Department`, `Team`, `TaskTemplate`, `DailyWorkLog` | **Unchanged** | — |

No field is removed; no field changes type or meaning.

## 3. API changes

| Method | Path | Status | Notes |
|---|---|---|---|
| `PATCH` | `/api/tasks/:id` | **new** | Field edits incl. reassign; `updatedAt` concurrency check |
| `DELETE` | `/api/tasks/:id` | **new** | Soft-delete, reason required |
| `PATCH` | `/api/tasks/:id/blocked` | **new** | Separate auth (assignee may block) |
| `GET` | `/api/tasks` | **extended** | `?scope=&status=&assignedTo=&page=&limit=`; response gains `total`, `scope` |
| `GET` | `/api/tasks/:id` | **new, P2** | Full task with comments/history; prerequisite for payload slimming |
| `GET` | `/api/calendar/context` | **new** | `{ workingDays, holidays, absences }`, role-scoped |
| `GET`/`PUT` | `/api/calendar/settings` | **new** | Write: `super_admin` |
| `GET`/`POST`/`DELETE` | `/api/calendar/absences` | **new** | Manager (own reports) + admin |
| `GET` | `/api/tasks/report` | **extended** | Adds quality + blocked-backlog fields; capacity becomes calendar-aware |

Everything else unchanged. All new routes follow the existing `authenticateJWT` + `requireRole` +
`asyncHandler` + `AppError` conventions.

## 4. Frontend / UX changes

**New:** `useTaskMutation`, `TaskActionMenu`, `TaskAdminPanel`, `AbsenceDialog`, Work Calendar tab
on `OrganizationPage`, scope toggle on the employee dashboard and team table.

**Modified:** `CreateTaskModal` → `TaskFormModal` (`mode` prop); `AttentionZone` (blocked item +
URL filters); `TeamWorkloadTracker` (expandable, calendar-aware, quick actions);
`TeamCapacityForecast` (non-working days rendered neutrally); `TeamSignalsPanel` (Quality block
filled); `EmployeeDrilldownModal`, `MyProgress`, `MyProgressSection` (quality + blocked);
`TaskTimerPanel` (block/unblock); every task-badge surface (blocked + rework badges — use
Iteration 13's carry-forward-badge rollout as the checklist); `taskHelpers`/`taskFormatters`.

**No new pages. No new routes.** Every action lands on a screen that already exists.

## 5. Metrics / reporting changes

| Field | Change |
|---|---|
| `capacityHoursToday` | 0 on non-working days / absence; halved on half-days |
| `plannedUtilizationPct`, `actualUtilizationPct` | Return `null` (render "—") when capacity is 0, **never 0%** |
| `isCapacityOverrunToday` | Always `false` on non-working days |
| `pendingBacklogAvgAgeDays` / `…Oldest…` | Redefined onto *blocked* tasks, measured in working days. Keep the old keys populated for one release, then remove |
| `pausedCount`, `blockedCount`, `blockedTasks[]` | **New** |
| `firstPassApprovalRate`, `reworkRate`, `reviewedTaskCount`, `reworkedTasks[]`, `hasQualitySignal` | **New** |
| Task objects | Gain `reworkCount`, `isBlocked`, `blockedReason` |
| Everything else | Unchanged — separate signals stay separate; **no composite score** |

Five components read the pending-age fields (`TeamSignalsPanel`, `EmployeeDrilldownModal`,
`MyProgressSection`, `MyProgress`, `buildEmployeeSignalSummary`). Update all five together (§30).

## 6. Migration requirements

**Effectively none.** Every schema change is additive or permissive; no backfill is needed for
tasks, history, blocking, or quality metrics — the latter works retroactively on existing data.

Two small items:
1. `OrgSettings` seed — handle by lazy upsert, not a migration script.
2. **Optional, recommended, reviewable:** a one-off script to soft-delete never-started daily tasks
   provisioned on days that are non-working under the new settings. Restrict strictly to
   `status: "Not Started"` with zero tracked time; log every affected ID first. Weekend rows are
   pure provisioning artefact, and leaving them means judging the new feature against a polluted
   baseline. Run it manually, review the output, keep it out of the repo (matching how Iterations 8
   and 13 handled their verification scripts).

## 7. Recommended implementation order

| Step | Work | Rationale |
|---|---|---|
| 1 | `taskService.stopRunningSessionForTask` + `PATCH` / `DELETE /api/tasks/:id` + history widening | Nothing else can be acted upon until the verbs exist |
| 2 | `useTaskMutation` + `TaskFormModal` (edit mode) + `TaskAdminPanel` + `TaskActionMenu` | Makes step 1 real for users. **Steps 1–2 are one deliverable** — don't ship the API alone |
| 3 | `calendarService` + `OrgSettings` + `Absence` + cron/provisioning guards + report capacity | Corrects the input data before any metric is tuned. Includes de-duplicating the capacity formula |
| 4 | Calendar UI: Work Calendar tab, `AbsenceDialog`, calendar-aware workload card and forecast | Makes step 3 visible and manageable |
| 5 | `isBlocked` flag + block/unblock endpoint + badges + Attention Zone item + blocked-age metric | Small, and depends on step 3 for working-day age |
| 6 | Quality/rework derivation + Quality block + rework badges | Zero dependencies — **can run in parallel from day one** if a second developer is available |
| 7 | `taskScopeService` + `scope` param + scope toggles + relabelled metric cards | More valuable once the actions from step 2 exist |
| 8 | Extended action wiring: URL filters, expandable workload card, reassign-picker capacity hints | The payoff — closes the Data → Insight → Action → Updated Data loop |
| 9 | P2 items | After the loop is whole |

## 8. What should explicitly NOT be changed

- **The 5-state workflow, `WORKFLOW_RULES`, and `isValidTransition`.** Locked. The blocked flag is
  deliberately orthogonal so none of it is touched.
- **The timer.** Server-authoritative elapsed calculation, event log, auto-stop on switch,
  refresh rehydration. It is the most correct part of the system. Only *call* its stop logic from
  new places; do not modify it.
- **The separate-signals model.** No composite score, now or as a "summary" convenience field.
- **`TeamCommandCenter`'s shared Manager/Admin structure.** Add to it; do not fork it.
- **The role-split task modals** (`TaskDetailModalCore` + thin wrappers). Extend via self-gating
  panels, following `ApprovalGatingPanel`'s convention.
- **The soft-delete rule.** No hard deletes, ever — including for absences.
- **`getProgressReport`'s role scoping.** Correct as of Iteration 11; new fields must respect it.
- **The daily-provisioning dedup ordering** (carry-forward loop before template loop) and the
  deliberately `isActive`-agnostic existence check. Both are load-bearing; Iteration 13 fixed a real
  duplication bug there.
- **The non-punitive framing** of every employee-facing signal. Rework and blocked must follow the
  same tone as the existing pattern flag.

## 9. Potential risks / regressions

| Risk | Severity | Mitigation |
|---|---|---|
| Reassignment orphans a running timer or loses tracked time | **High** | One shared `stopRunningSessionForTask`; never delete sessions; test with a live timer |
| Capacity formula updated in one of its two locations only | **High** | De-duplicate it in step 3 *before* adding calendar logic — not after |
| The pending→blocked redefinition ships to only some of its five consumers | **High** | Keep old keys populated for one release; grep `pendingBacklog` before merging |
| Zero-capacity days produce division-by-zero or a misleading 0% | Medium | Return `null`, render "—"; explicit test for a Sunday |
| Optimistic patches drift from server state | Medium | Reuse `useTaskStatusMutation`'s proven reconcile-and-rollback shape verbatim |
| Weekend-cleanup script deletes real work | Medium | Restrict to `Not Started` + zero tracked time; log IDs; soft-delete only; run manually |
| Scope filter hides overdue tasks | Medium | The "today" definition explicitly includes them — the one rule to get right |
| `TaskFormModal` generalisation regresses the create flow | Medium | Edit mode is additive; smoke-test create first, and check the capacity banner excludes the task's own hours in edit mode |
| Quality denominator includes non-reviewed tasks | Medium | Denominator is `wasEverReviewed && Completed`; assert with a daily-tasks-only employee |
| Concurrent edits silently overwrite | Low | `updatedAt` check → `409 TASK_MODIFIED` |
| Timezone drift in "today" and absence boundaries | Low | Single org timezone from `OrgSettings`; normalise to start-of-day on write |

## 10. Final recommendation

**Build the mutation layer and its action surfaces first, as one deliverable, then the work
calendar.**

This codebase's problem is not missing features — it is missing *verbs*. The measurement layer is
genuinely good: signals kept separate, metrics labelled honestly, every flag traceable to the tasks
that caused it. It sits on a task model that cannot be corrected and a calendar that thinks Sunday
is a workday. The result is a manager who is told precisely what is wrong every morning, reading
numbers that are partly measuring weekends, with no button to fix any of it.

The plan above adds **no new pages and no new dashboards.** It adds a PATCH, a DELETE, a calendar,
a boolean flag, one derived metric, and a dropdown menu that appears wherever a task does. Steps
1–5 are roughly two focused iterations and they close the Data → Insight → Action → Updated Data
loop that the product has been missing since Iteration 3.

Step 6 (quality/rework) is worth calling out separately: it is the cheapest item here, needs no
migration, works retroactively on every task already in the database, and fills a UI slot that is
already rendered and waiting. If a second developer is available, start it on day one.

Resist adding anything to the dashboards until the loop closes. They are already ahead of what the
model beneath them can support.
