# Product Gap Analysis

*Written 2026-08-16, from a full read of the codebase as it stands on `feat/workflow-capacity-signals`.
This is a discovery document — no code was changed.*

---

## 1. What This System Currently Is

A **daily work-execution and workload-visibility tool for a single small office (~10 people).**

It is not a project manager (no projects, milestones, dependencies, or Gantt). It is not a
timesheet/payroll system (no approval of hours, no billing). What it actually does is answer
one question every day, for one manager and one admin:

> *"What is each person supposed to do today, are they doing it, is it too much, and is
> anything going wrong?"*

Everything in the codebase serves that: a locked 5-state task workflow, a server-authoritative
timer, auto-generated daily tasks with carry-forward, single-day capacity math, and a set of
deliberately **separate** signals (completion, time efficiency, capacity, overdue, pending
backlog, estimation pattern) that are never fused into one score.

The implementation is unusually disciplined for its size — the locked product logic in
`CLAUDE.md` is genuinely honoured in the code, not just documented.

---

## 2. Current Roles

| Role | Current Responsibilities | Current Capabilities |
|---|---|---|
| **Super Admin** | Owns the org structure and sees everything | Departments/Teams/Users CRUD, Daily Task Templates, org-wide Reports & Analytics, **plus** the full Manager command centre org-wide (shared `TeamCommandCenter`) |
| **Manager** | Runs the day for their direct reports | Create/assign tasks, approve or send back In-Review work, see workload + capacity + 7-day forecast + per-employee signals, read team work logs |
| **Employee** | Executes and records work | See own tasks (board/list), daily tasks auto-provisioned, start/pause/stop timer, self-create tasks, comment, submit daily work log, view own progress page |

No other roles exist. Role checks are enforced server-side on every route (verified).

---

## 3. Current Major Workflows

### Daily task provisioning
Admin creates template → ✅ midnight cron provisions for all active employees → ✅ carry-forward of incomplete past dailies (dedup bug fixed) → ✅ appears on employee dashboard with "Carried from Aug 12" badge → 🔴 **runs 7 days a week, including weekends and holidays**

### Assigned task lifecycle
Manager creates task w/ estimate + due date → ✅ capacity warning if it overloads the day → ✅ employee starts timer → ✅ status auto-flips In Progress/Pending → ✅ employee submits In Review → ✅ manager approves or sends for rework → ✅ Completed locks the record → 🔴 **task can never be edited, reassigned, rescheduled, or cancelled at any point**

### Time tracking
Start → ✅ auto-stops any other running timer → ✅ pause/resume events stored server-side → ✅ stop → ✅ per-task rollup + estimated-vs-actual overrun badge everywhere it appears. **This one is complete and solid.**

### Capacity & workload
Employee has working/break hours → ✅ planned hours from remaining estimates → ✅ per-employee capacity bar → ✅ 7-day forecast grid → ✅ over-capacity flag on the manager's Attention Zone → ⚠️ **the only action offered next to an over-capacity employee is "+ assign another task"**

### Review & quality
Employee submits → ✅ Pending Review queue → ✅ approve or rework, feedback required → ✅ logged to task history → 🔴 **rework is never counted anywhere; approved-first-time and bounced-three-times look identical in every report**

### Daily work log
Employee opens form → ✅ hours prefilled from tracked time → ✅ submits → ✅ manager/admin can read → ⚠️ `tasksCompleted` is free text although the system knows the answer → 🔴 **nobody can see who didn't submit**

### Reporting
`/api/tasks/report` → ✅ per-employee signals, role-scoped correctly → ✅ drill-down to the exact tasks behind each flag → ✅ timeframe filter (admin only) → 🟡 **every number is a current snapshot; no comparison to last week/month**

---

## 4. What Already Works Well

Do not rebuild these.

- **Server-authoritative timer.** Pause/resume events, elapsed calculation, auto-stop on switch, refresh-safe rehydration. Correct.
- **The locked 5-state workflow** and its transition table — one source of truth in `Backend/config/workflow.js`, used by both roles.
- **Signals kept separate, never scored.** Resisting the composite-score temptation is the right call and it held.
- **Traceability.** Every flag (overrun, pattern, capacity) drills down to the specific tasks that caused it. `task.history` records who changed what, when, from what.
- **Manager/Admin parity via one shared component.** Structurally prevents the two dashboards from drifting.
- **Metric labelling.** Numbers come with denominators and context, per §14/§41. Genuinely better than most dashboards.
- **Access control.** Every read and write is scoped server-side by role; the Iteration 14 pass closed the real holes.
- **Empty/loading/error states.** Present nearly everywhere, with retry paths.

---

## 5. Critical Gaps — P0

| Gap | Current Situation | Why It Matters | Recommended Solution |
|---|---|---|---|
| **A task can never be changed after creation** | The only task mutations that exist are `PUT /:id/status` and `POST /:id/comments`. No edit endpoint, no reassign, no reschedule, no cancel. `Task.isActive` is filtered on everywhere but **nothing in the codebase ever sets it to false.** | This is the product's biggest hole. A wrong assignee, a typo'd title, a bad estimate, or a task that's no longer needed is permanent and pollutes every metric forever. Worse: the entire capacity feature set exists so a manager can *"redistribute/reschedule"* (Locked §6) — and there is no reschedule or redistribute action anywhere in the app. | Add `PATCH /api/tasks/:id` (title, description, priority, estimatedHours, dueDate, assignedTo, category) and `DELETE /api/tasks/:id` (soft-delete → `isActive: false`). Log every field change to `task.history`. Gate: manager/admin within scope; employee may edit only their own self-created, not-yet-completed tasks. Completed tasks stay locked (Locked §4). Surface as "Edit / Reassign / Cancel" in the manager task detail modal and the workload card. |
| **No concept of non-working days or absence** | The cron provisions daily tasks `0 0 * * *` — every calendar day. Capacity is `dailyWorkingHours − breakHours` for Saturday, Sunday, and public holidays alike. There is no leave, sick day, or half-day anywhere in the data model. | Every signal the product is built on gets corrupted weekly: weekend dailies pile up as carry-forwards, completion rates sag, pending backlog ages across weekends, and everyone reads as 0% utilised on Sunday. A manager returning Monday sees a fake crisis. At an office that presumably doesn't work weekends, this is a data-integrity problem, not cosmetics. | Two pieces: (1) an org-level working-days config (+ a holiday list) that gates cron provisioning and zeroes capacity on non-working days; (2) a per-employee absence record (date range + type) that zeroes their capacity, suppresses provisioning, and excludes those days from completion/pending/overdue maths. Show absence on the workload cards and the forecast grid. |
| **"Pending" conflates *paused* with *blocked*, corrupting pending-backlog age** | `workSessionController.setTaskStatus` flips a task to Pending on every pause, stop, and task-switch. `getPendingAgeDays` then measures from that transition. | An employee who stops their timer at 6pm has a task that has been "pending" for 15 hours by morning, and 63 hours after a weekend. The manager's "pending backlog aging significantly" signal is therefore mostly measuring *nights and weekends*, not blocked work. This directly violates §41 ("do not present a metric without enough context to interpret it") and undermines one of the seven core signals. | Either (a) count pending age only in working hours, or preferably (b) separate the two meanings: keep the timer-derived state as "Paused" and let an employee explicitly mark a task **Blocked** with a reason. Then pending-backlog age measures what the locked logic actually intended, and a manager finally gets the "what is stuck and why" view the product is missing. |

---

## 6. Important Gaps — P1

| Gap | Current Situation | Why It Matters | Recommended Solution |
|---|---|---|---|
| **The Quality/Rework signal was specified but never built** | Locked §9 and §11 both name Quality/Rework as one of the separate signals. Manager rework is a real action (`ApprovalGatingPanel` → In Review → In Progress) and it's already recorded in `task.history`. **No report, badge, or metric counts it.** | Task count is explicitly not quality (§9). Right now the system cannot distinguish work approved first time from work bounced back three times — the one thing that would actually tell a manager about quality. The data is already in the database. | Derive it, don't store new state: count `history` entries where a manager moved In Review → In Progress. Add `reworkCount` per task and `reworkRate` / `firstPassApprovalRate` per employee to `getProgressReport`, plus a rework badge on the task row and a Quality section in the drill-down. |
| **No user deactivation** | `User.isActive` exists and is filtered on everywhere, but there is no endpoint or UI to set it false — same pattern as tasks. | Soft-delete is one of only two Core Rules in `CLAUDE.md` and it is unimplemented for both models it applies to. Someone who leaves stays in every assignee dropdown, every capacity grid, and every report forever. | `PATCH /api/users/:id/deactivate` (super_admin), with a guard for open tasks that must be reassigned first — which depends on the P0 reassign work. Same for departments/teams. |
| **Everything is all-time; nothing defaults to today** | The employee board/list, the manager task table, and every metric card show all tasks ever ("All-time · every task ever assigned to you"). The Completed Kanban column grows without bound. Only the admin Reports tab has a timeframe filter. | Locked §7 says *"primary view is daily"*, but the primary surfaces are all-time. "Assigned Tasks: 143" is not a number anyone can act on, and after a year of daily tasks the board is unusable. `GET /api/tasks` also returns every task with full comments and history populated, unpaginated. | Default the employee dashboard and team task table to **Today / This Week**, with an explicit "All time" toggle. Add server-side date filtering + pagination to `GET /api/tasks`. |
| **A flagged problem has no action attached to it** | `AttentionZone` correctly says "2 employees over capacity today" and links to the workload cards. The only button on those cards is **+ Assign task**. | The whole data→insight chain is built and then dead-ends. The manager is told exactly what's wrong and then handed the one action that makes it worse. | Once P0 task-mutation exists, add "Reassign" and "Move to tomorrow" actions directly on the over-capacity employee's task list, with the capacity bar updating as they go. This is the payoff for all the capacity work already done. |
| **Work logs float free of the task system** | `tasksCompleted` is a free-text string; `hoursWorked` is prefilled from tracked time and then editable with no reconciliation; nobody can see who *didn't* submit a log. | The system already knows which tasks the employee completed today and exactly how many hours were tracked. Asking them to retype it is duplicate data entry that also produces a second, conflicting source of truth. And an unenforced daily ritual with no compliance view will quietly stop happening. | Prefill `tasksCompleted` from today's actually-completed tasks (editable). Show tracked hours next to the entered figure and flag a large divergence. Add a "Today's log submissions: 6 of 8" row to the manager's work-log section. One log per employee per day (unique index). |

---

## 7. Useful Gaps — P2

| Gap | Current Situation | Why It Matters | Recommended Solution |
|---|---|---|---|
| **No awareness that anything changed** | No polling, no websockets, no in-app inbox. A newly assigned task, a rework bounce, or a manager comment is invisible until the user reloads the page. Noted as an explicit scope cut in Iteration 13. | With dashboards left open all day, an urgent task assigned at 10am may not be seen until after lunch. Note this is *not* the push-notification the locked logic rejects (§5) — that ruling was about overrun alerts. | A modest "3 updates — refresh" bar, or a 60-second poll of a cheap `updatedSince` endpoint. Avoid building a notification centre. |
| **No trends** | Every number is a right-now snapshot. The only historical signal is the 5-task overrun pattern. | Locked §10 wants patterns surfaced. "Completion 62%" means nothing without "was 78% last week". | Add a week-over-week delta to the existing employee report rows. Cheap — the date filter already exists on the endpoint. |
| **Managers can read work logs but not respond** | Read-only table. `problemsFaced` — the one place blockers get written down — goes nowhere. | An employee reporting a blocker gets silence, so they stop reporting. | Let a manager acknowledge/comment on a log. Ideally link a reported blocker to the task it's blocking (pairs with the P0 Blocked state). |
| **No estimate at all is treated as "on time"** | `computeOverrunFields` returns `isOverrun: false` and `estimationAccuracy` defaults to 100% when `estimatedHours` is 0, which is the default. | An unestimated task silently reads as perfectly estimated, quietly inflating accuracy. | Report "no estimate" as its own category, and warn on task creation when the estimate is 0. |

---

## 8. Future / Optional — P3

- CSV/PDF export of reports.
- Full V2 multi-day capacity planning with drag-to-reschedule (the read-only forecast grid already covers most of the value).
- Recurring **assigned** (non-daily) tasks — weekly/monthly.
- Weekday scheduling on daily templates (e.g. "Monday standup only") — worth doing *with* the P0 working-days work, not before.

---

## 9. Existing Features That Need Better Integration

| Existing Feature | Current Problem | What Should Connect | Expected Result |
|---|---|---|---|
| Capacity + forecast | Fully calculated, clearly displayed, and **not actionable** | Task reassignment / rescheduling | A manager can fix an overload in the place they discover it |
| `task.history` rework transitions | Recorded but never read | `getProgressReport` quality signal | First-pass approval rate exists without storing anything new |
| Tracked hours + completed tasks | Known precisely by the system | The daily work log form | Log becomes a review-and-confirm, not re-typing |
| `isActive` on Task and User | Filtered on everywhere, never set | Cancel-task and deactivate-user actions | The Core Rule soft-delete policy actually functions |
| Overdue / overrun / pattern flags | Shown to the manager as counts | The task rows those counts came from, with an action | Flag → cause → fix in one place instead of two screens |
| `problemsFaced` in work logs | Free text in a table nobody acts on | The blocked task it refers to | Blockers become trackable instead of anecdotal |
| Report timeframe filter | Admin Reports tab only | Employee dashboard + manager task table | The "primary view is daily" promise is finally kept |

---

## 10. Role-Specific Gaps

### Super Admin
Has near-complete visibility and the best-built screens in the app. What's missing is **lifecycle control**: cannot deactivate a user, department, or team; cannot set org working days or holidays; cannot cancel a bad task. The admin owns configuration but the configuration surface stops at creation.

### Manager
Sees everything and can change almost nothing. Can create tasks and approve/reject work — that's the complete action set. Cannot reassign, reschedule, re-estimate, or cancel. Cannot see rework rates, who's on leave, or who hasn't logged their day. Every P0 gap lands hardest here: this role is currently *informed but not empowered*.

### Employee
The best-served role — daily tasks arrive automatically, the timer is frictionless, and the personal progress page is non-punitive and honest. Gaps: cannot say **"I'm blocked"** (only pause, which is silently read as pending backlog); cannot correct a task they created; cannot see today's plan separated from an all-time backlog; and gets no signal when new work arrives.

---

## 11. End-to-End Product Gap

```
Admin sets up org + daily templates
        ↓                                    🔴 no working days / holidays / leave
Daily tasks auto-provision each morning
        ↓                                    ✅ solid (incl. carry-forward)
Manager assigns work with estimate + due date
        ↓                                    ✅ incl. capacity warning
Employee tracks time against tasks
        ↓                                    ✅ the strongest part of the system
Status advances through the locked workflow
        ↓                                    🔴 "Pending" means both paused and blocked
Manager reviews → approves or sends back
        ↓                                    🔴 rework is never counted
Signals surface overload / overrun / backlog
        ↓                                    ✅ excellent, traceable to the task
Manager acts on what the signals say
        ↓                                    🔴🔴 THE BREAK — no reassign, reschedule,
                                                  re-estimate, or cancel exists at all
Work log closes out the day
                                             ⚠️ disconnected from the task data above
```

**The chain is strong from data all the way to insight, and then stops.** Nine-tenths of this
product is a very good observation system with no controls attached.

---

## 12. Minimum Changes Needed

If only four things get built:

1. **Task mutation** — `PATCH` (incl. reassign + due date) and soft-delete `DELETE`, history-logged.
2. **Working days + absence** — org calendar and per-employee leave, wired into provisioning and capacity.
3. **Split Paused from Blocked** — so pending-backlog age measures blocked work, not evenings.
4. **Rework / first-pass approval rate** — derived from history already in the database.

Together these close the data→action break, stop two headline metrics from lying, and deliver
the one signal the locked logic asked for and never got. Everything else in this document is
improvement; these four are completion.

---

## 13. Recommended Development Order

| # | Work | Why here |
|---|---|---|
| 1 | **Task mutation API + UI** (edit, reassign, reschedule, cancel) | Nothing else can be acted on until this exists; user deactivation depends on it too |
| 2 | **Working days, holidays, and employee absence** | Corrects the input data every downstream signal reads — do it before tuning any metric |
| 3 | **Paused vs Blocked** | Small change; immediately fixes pending-backlog age and gives employees a voice |
| 4 | **Rework / first-pass approval signal** | Pure derivation, zero dependencies, high value — can run in parallel with 2 and 3 |
| 5 | **Default daily/weekly scoping + task pagination** | Now the correct action set exists, make the daily view the default one |
| 6 | **Reassign/reschedule actions on the capacity cards** | The payoff for 1 + 2 — completes the data→insight→action loop |
| 7 | **User/department deactivation** | Needs 1 (reassign open tasks before deactivating) |
| 8 | **Work log ↔ task integration + submission compliance** | Improves an already-working flow |
| 9 | **Refresh awareness, trends, log responses** | Polish, once the core loop is whole |

---

## 14. What NOT To Build Right Now

- **A composite productivity score.** Explicitly forbidden by Locked §11 and correctly resisted so far. The separate signals aren't validated in practice yet.
- **Push or email notifications.** An in-app "something changed" cue is enough at ten people in one office. Don't build a notification service.
- **Chat / messaging.** Task comments already exist and are barely used. A second channel would fragment context.
- **Calendar integration, gamification, leaderboards.** Nothing in the product points at these, and leaderboards directly contradict the non-punitive framing the app has carefully maintained.
- **File attachments / proof uploads.** Explicitly deferred; still deferred.
- **Full V2 drag-and-drop capacity planning.** The read-only 7-day forecast already delivers most of the value; the missing half is reassignment (item 1), not a planning canvas.
- **A mobile app.** The web UI is already responsive.
- **AI summaries.** `buildEmployeeSignalSummary` already produces the narrative deterministically, for free, and it reads well. Adding an LLM here would cost money and add non-determinism to a management metric.
- **Microservices / queues / caching layers.** Ten users. The recent index pass is the right level of performance work.

---

## 15. Final Recommendation

**Build the task mutation layer first, then the working calendar.**

This codebase has a rare problem: the analytics are more mature than the operations underneath
them. Someone built a genuinely thoughtful measurement system — separate signals, honest
labels, real drill-downs — on top of a task model that cannot be corrected, reassigned,
rescheduled, or cancelled, and a calendar that thinks Sunday is a workday. The result is a
manager who is told precisely what's wrong every morning and given no way to fix it, reading
metrics that are partly measuring weekends.

The next iteration should add **verbs, not views.** Give the manager the ability to change a
task; teach the system which days are real working days; separate "paused" from "blocked"; and
count the rework that's already sitting in the database. That is roughly one focused iteration
of work, it adds no new screens, and it turns a very good reporting tool into a system that
actually manages work.

Resist adding anything to the dashboards until then — they are already ahead of what the
underlying model can support.
