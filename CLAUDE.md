# CLAUDE.md - Employee Work Management & Productivity Tracker

## Project Overview
An MVP-first web-based Employee Work Management & Productivity Tracking System built using the MERN stack for a ~10-person office (1 Super Admin, 1 Manager, and Employees).
* **Core Philosophy**: Fast, happy-path-only development for MVP stages. Avoid adding elaborate validations, guards, or edge cases until the hardening phase.
* **Core Rules**:
  1. Timer events (start, pause, resume, stop) are always registered, processed, and computed server-side. Client-side timestamps are not trusted.
  2. Soft-delete only (`isActive: false`) for Users and Tasks; never hard-delete from the database.

---

## Locked Product Logic (Core Rules)
These rules are locked product decisions (see `Employee_Productivity_Tracking_Locked_Logic.pdf`). Treat them as constraints on any future feature work — do not silently deviate from them.

1. **Task Structure**
   - Two task types only: Daily Tasks and Manager/Assigned Tasks.
   - Daily Tasks are mandatory and carry forward when incomplete; carried-forward tasks appear alongside new daily tasks, never merged into one.
   - Assigned Tasks carry a custom due date/time, estimated time, and Low/Medium/High priority.
   - Daily task estimated time counts toward the employee's daily capacity calculation.

2. **Task Timer & Time Tracking**
   - Exactly one active timer per employee at a time; starting a new task's timer auto-pauses/stops the current one.
   - Start, Pause, Stop supported; Pause never requires a reason.
   - Individual work sessions/time logs are retained per task, never discarded.

3. **Task Workflow**
   - Canonical flow: Not Started → In Progress → Pending → In Review → Completed.
   - "In Review" is used only when a task requires manager review/approval — tasks that don't require approval must be completable directly by the employee without entering review.

4. **Completed Task Rules**
   - Once Completed, task status and historical time logs are locked — no further edits to the historical record.
   - Comments/context may still be appended after completion.

5. **Estimated vs Actual Time**
   - Track Estimated Time and Actual Time (timer-derived) per task.
   - Time Variance = Actual − Estimated; overrun % derives from the same numbers.
   - When Actual exceeds Estimated, surface a task-level warning/alert visible to both employee and manager (not a push notification).
   - Any metric shown to a manager must have a clear label — never raw unexplained numbers.

6. **Employee Capacity & Workload**
   - V1 is single-day capacity planning only (no multi-day/calendar planning yet — that's V2).
   - Daily capacity = working hours minus defined breaks.
   - Daily Tasks + Assigned Tasks both count toward planned capacity.
   - Remaining capacity is driven by remaining estimated/planned work, not by actual time already logged.
   - A new assignment that would push planned work past capacity must flag the employee as over capacity so the manager can redistribute/reschedule.

7. **Productivity Measurement**
   - Primary view is daily.
   - Track Daily Task Completion Rate and Assigned Task Completion Rate separately; Overall Completion Rate is a derived summary, not the primary metric.
   - Track per-task Estimated vs Actual so managers can pinpoint exactly which tasks overran.
   - Capacity Utilization is hybrid: Planned/Estimated Utilization and Actual Utilization are two separate metrics.
   - Actual work exceeding daily capacity is its own "Actual Capacity Overrun" signal, distinct from utilization.
   - Low utilization is a signal only — never auto-labeled as "low productivity."

8. **Deadline, Pending & Carry-Forward Logic**
   - Overdue is a signal, not an automatic heavy penalty.
   - Track pending backlog, including how long each task has sat pending.
   - Carried-forward daily tasks must never be counted as brand-new tasks in completion metrics; show new vs. carried-forward separately.

9. **Quality & Review**
   - Task count alone never equals productivity quality.
   - Distinguish Approved/completed work from returned/rework-required work.
   - Work awaiting manager review is not to be treated as incomplete employee work.
   - A task returned for rework goes back into the employee's active workload.

10. **Estimation Accuracy & Patterns**
    - Repeated overruns are tracked as a pattern signal, never used to directly punish an employee.
    - A high proportion of recent overrunning tasks indicates an estimation/time-efficiency pattern worth surfacing.
    - Always retain underlying task-level data so managers can investigate root cause.

11. **Productivity Score Philosophy**
    - Do NOT build a single composite Productivity Score.
    - Keep signals separate: Task Completion, Time Efficiency, Capacity Utilization, Overdue, Pending Backlog, Quality/Rework, Capacity Overrun.
    - A combined score is only reconsidered later, after these individual metrics are validated in practice.

12. **Manager/Admin Visibility**
    - Managers need both employee-level summary metrics and task-level drill-down — never summary-only.
    - Any flagged problem must be traceable to the specific task(s) that caused it.
    - Mental model to build features against: Task → Time → Capacity → Completion → Deadline → Quality → Pattern.

**Deferred (do not build unless explicitly asked):** task attachments (photos/PDFs/proof), multi-day calendar/capacity planning (V2), fixed thresholds for "meaningful" overrun, combined productivity score.

---

## Development Commands

### Backend (Express App)
* **Run server**: `node index.js` (from the [Backend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend) directory)
* **API URL**: `http://localhost:3000`

### Frontend (React App)
* **Run client**: `npm run dev` (from the [Frontend](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend) directory)
* **Local URL**: `http://localhost:5173`

---

## Repository Folder Structure

```text
ProgressTracker/
├── Backend/                # Express Server Application
│   ├── .env                # Local environment variables
│   ├── .env.example        # Reference environment variables
│   ├── index.js            # Server entry point and health routes
│   └── package.json        # Server configuration & dependencies
├── Frontend/               # Vite React Client Application
│   ├── src/
│   │   ├── assets/         # Images and SVG icons
│   │   ├── App.css         # Styling for the application
│   │   ├── App.jsx         # Main layout and health checks
│   │   ├── index.css       # Global styles
│   │   └── main.jsx        # Mount point
│   ├── package.json        # Client configuration & dependencies
│   └── vite.config.js      # Vite build setup
├── docs/ai/                # AI context & architecture guides
├── AGENTS.md               # AI agent instructions
└── CLAUDE.md               # This project index & iteration guide
```

---

## Data Model (Progressive)

### User Schema (`Backend/models/User.js`)
* `name`: String (required, trimmed)
* `email`: String (required, unique, lowercase, trimmed)
* `passwordHash`: String (required)
* `role`: String (enum: `['super_admin', 'manager', 'employee']`, default: `'employee'`)
* `department`: ObjectId (ref: `'Department'`, default: `null`)
* `team`: ObjectId (ref: `'Team'`, default: `null`)
* `manager`: ObjectId (ref: `'User'`, default: `null`)
* `isActive`: Boolean (default: `true`, utilized for soft-delete)
* Timestamps: `createdAt`, `updatedAt` (automatic)

### Department Schema (`Backend/models/Department.js`)
* `name`: String (required, trimmed)
* `description`: String (default: `""`)
* `isActive`: Boolean (default: `true`, for soft-delete)
* Timestamps: `createdAt`, `updatedAt`

### Team Schema (`Backend/models/Team.js`)
* `name`: String (required, trimmed)
* `department`: ObjectId (ref: `'Department'`, required)
* `description`: String (default: `""`)
* `isActive`: Boolean (default: `true`, for soft-delete)
* Timestamps: `createdAt`, `updatedAt`

### Task Schema (`Backend/models/Task.js`)
* `title`: String (required, trimmed)
* `description`: String (default: `""`)
* `category`: String (default: `"General"`, trimmed)
* `department`: ObjectId (ref: `'Department'`, default: `null`)
* `assignedBy`: ObjectId (ref: `'User'`, required)
* `assignedTo`: ObjectId (ref: `'User'`, required)
* `priority`: String (enum: `['low', 'medium', 'high']`, default: `'medium'`)
* `estimatedHours`: Number (default: `0`)
* `dueDate`: Date (default: `null`)
* `status`: String (enum: `['Not Started', 'Accepted', 'In Progress', 'Waiting for Review', 'Completed', 'Approved', 'Rejected', 'Reopened']`, default: `'Not Started'`)
* `progressPercentage`: Number (default: `0`)
* `comments`: Array of `{ text (required), author (ref: 'User', required), createdAt }`
* `isActive`: Boolean (default: `true`, for soft-delete)
* Timestamps: `createdAt`, `updatedAt`

### WorkSession Schema (`Backend/models/WorkSession.js`)
* `task`: ObjectId (ref: `'Task'`, required)
* `employee`: ObjectId (ref: `'User'`, required)
* `startedAt`: Date (default: `Date.now`)
* `events`: Array of `{ type (enum: ['pause', 'resume']), timestamp: Date }`
* `stoppedAt`: Date (default: `null`)
* `totalSeconds`: Number (default: `0`, computed server-side)
* Timestamps: `createdAt`, `updatedAt`

---

## API Conventions

* Base path: `/api`
* Health Check: `GET /api/health`
* Future endpoints will follow REST conventions, returning standard JSON payloads.

---

## Iteration Progress Log

### Iteration 0: Project Skeleton Setup
* Configured `Frontend/package.json` to include `react-router-dom` and `axios`.
* Setup `Backend/index.js` health checks (`/` and `/api/health`).
* Updated `Frontend/src/App.jsx` and `App.css` to verify end-to-end client-server connectivity.
* Created `.env.example` reference and initialized `.env`.

### Iteration 1: Login + Roles
* Installed `bcryptjs` and `jsonwebtoken` in backend.
* Created the Mongoose `User` schema in `Backend/models/User.js`.
* Set up Auth middlewares (`authenticateJWT`, `requireRole`) in `Backend/middleware/authMiddleware.js`.
* Built login & profile fetch endpoints in `Backend/controllers/authController.js` and `Backend/routes/auth.js`.
* Created a database seed script in `Backend/seed.js` creating 1 Super Admin, 1 Manager, and 8 Employees.
* Integrated MongoDB connection and mounted auth routes in `Backend/index.js`.
* Implemented the client-side Auth Context (`AuthContext.jsx`) and protected routing gates (`ProtectedRoute.jsx`, `Layout.jsx`, `Login.jsx`).
* Added placeholder dashboards for `SuperAdmin`, `Manager`, and `Employee` roles.

### Iteration 2: Org Management (Departments / Teams / Users)
* Created `Department` and `Team` Mongoose models.
* Created CRUD controllers and routes for `/api/departments`, `/api/teams`, `/api/users`.
* All modification routes gated to `super_admin` role via `requireRole` middleware.
* Rebuilt `SuperAdminDashboard.jsx` with a tabbed UI (Departments / Teams / Users tabs).
* Each tab features a live list table, "+ New" create modal, and inline edit modal with proper selectors.
* Team creation auto-filters teams by selected department in the Users tab.

### Iteration 3: Tasks + Status Workflow
* Created the Mongoose `Task` schema in `Backend/models/Task.js` with comments array.
* Built task controllers and routes for task creation, fetching, status updates, and comment logging.
* Automatically mapped progress percentages on the server based on status progression (e.g. In Progress = 50%, Completed/Approved = 100%).
* Mounted task routes at `/api/tasks` inside `Backend/index.js`.
* Rebuilt `ManagerDashboard.jsx` using `shadcn/ui` Cards, Tables, Dialogs, and Textareas. Features a metrics overview grid, a "Create Task" form modal, team task tables, and a task detail modal that triggers task approvals or rejections (with comments).
* Rebuilt `EmployeeDashboard.jsx` using `shadcn/ui` Cards, Tables, and Dialogs. Features a personal tasks queue table, a details overview, comment posts, and transition action triggers (Accept, Start Work, Submit for Review).

### Iteration 4: Timer — Start / Pause / Resume / Stop
* Created `WorkSession` Mongoose schema in `Backend/models/WorkSession.js` representing active/completed work timer sessions.
* Created WorkSession routes and controllers implementing strict server-side elapsed seconds calculations, event logging, and active session fetching.
* Configured auto-stop constraints: starting a new timer automatically halts any running session, recording its elapsed duration.
* Implemented client-side context hooks (`TimerContext.jsx`) resolving page refresh rehydrations.
* Rendered a Floating Sidebar widget for Employees with live MM:SS ticking clock and action triggers (Play, Pause, Stop).
* Integrated row timer toggles and modal control panels within `EmployeeDashboard.jsx`.

### Iteration 5: Daily Work Log

#### DailyWorkLog Mongoose Schema (`Backend/models/DailyWorkLog.js`)
| Field | Type | Notes |
|---|---|---|
| `employee` | ObjectId → User | Required reference |
| `date` | Date | Defaults to `Date.now` |
| `todaysWork` | String | Required. Description of work done |
| `hoursWorked` | Number | Required. Decimal (e.g. 3.5) |
| `tasksCompleted` | String | Optional. Free-text task IDs or names |
| `problemsFaced` | String | Optional. Blockers / bugs encountered |
| `nextPlan` | String | Optional. Plan for tomorrow |
| `remarks` | String | Optional. Additional notes for manager |

#### Implementation Notes
* Added `GET /api/work-sessions/today-hours` endpoint: sums all of a logged-in employee's WorkSession totals started today (including live active session) and returns `{ hoursWorked }` as a decimal.
* Created `GET /api/daily-work-logs` endpoint: employees see only their own logs; managers see all their subordinates' logs (filterable by `?employee=<id>`); super admin sees all.
* Created `POST /api/daily-work-logs` endpoint: restricted to `employee` role. Saves a new log entry.
* Built `Frontend/src/pages/WorkLogs.jsx`: Employee view to submit logs (auto-prefilling hours from today's timer), a paginated table of past entries, and a detail drill-down dialog.
* Added `/work-logs` as a real sidebar navigation link for employees in `Layout.jsx`.
* Added `/work-logs` route to `App.jsx` accessible by all roles (employee / manager / super_admin).
* Appended a "Team Work Logs" card to `ManagerDashboard.jsx` with employee dropdown filter and recent log table.

### Iteration 6: Workflow Correction (Locked Logic §3–4)
* Replaced the 8-state `Task.status` enum with the locked 5-state workflow: `Not Started → In Progress → Pending → In Review → Completed`.
* Rewrote `Backend/config/workflow.js` (`WORKFLOW_RULES`) around the new states. Self-assigned/Daily tasks skip review and go `In Progress → Completed` directly; manager-assigned tasks route through `In Review`. `Completed` is a terminal state for employees (no employee-side reopen) — only managers/super_admin can move a `Completed` task back to `In Progress` for correction.
* `Pending` is driven automatically by the timer, not chosen manually: `Backend/controllers/workSessionController.js` now flips the task to `Pending` on pause, on switching to another task, and on stop, and back to `In Progress` on resume/restart — each transition is appended to `task.history` server-side (matches the "timer events are always server-computed" core rule).
* Updated `taskController.js` (`getProgressForStatus`, `getProgressReport`, `ensureDailyTasks`) and `SuperAdminDashboard.jsx`'s health-report chart to the new status set; replaced the old `rejectedTasks` signal with `pendingTasks`/`inReviewTasks`.
* Rebuilt the status logic in `EmployeeDashboard.jsx` and `ManagerDashboard.jsx`: workflow steppers, Kanban board (now 5 columns, incl. a dedicated Pending column), badge variants, and the manager's approve/rework flow (rework returns an `In Review` task to `In Progress`, matching "returned work goes back into the employee's active workload").
* Fixed `Backend/seed.js` demo data to use the new statuses so the seed script stays runnable.

### Iteration 7: Estimated vs Actual + Task-Level Alerts (2026-08-15)
* Added a `computeOverrunFields(estimatedHours, totalTrackedSeconds)` helper in `Backend/controllers/taskController.js` deriving `timeVarianceSeconds` (Actual − Estimated) and `overrunPercentage`; `isOverrun` is only true when an estimate is actually set and actual time has exceeded it.
* Wired the helper into all three places a task is serialized with tracked time: the batch list path (`attachTrackedSecondsToTasks`), the single-task path (`getTaskWithTime`, used by status updates/comments), and `createTask`'s response.
* Added `formatOverrun(task)` to `Frontend/src/lib/taskFormatters.js`, returning a `"+X% over est."` string or `null`.
* Surfaced a destructive-variant overrun badge (visible signal, not a push notification, per Locked Logic §5) on both Employee and Manager views: `TaskListView`, `TaskKanbanBoard`, `DailyTasksSection` (employee), `TeamTasksTable`, `PendingReviewQueue` (manager), and the shared `TaskDetailModal`'s info grid.

### Iteration 8: Capacity & Workload — V1 Single-Day (2026-08-15)
* Added `dailyWorkingHours` (default 8) and `breakHours` (default 1) to the User schema (`Backend/models/User.js`); wired them through `userController.js`'s `populateFields`, `createUser`, and `updateUser`.
* Added `getPlannedHoursForDay(tasks, employeeId, day)` and `getEmployeeCapacity(employee, tasks, extraHours)` to `Frontend/src/lib/taskHelpers.js` — planned hours sum the estimated hours of that employee's Daily + Assigned tasks landing on the given day that aren't yet Completed (remaining-estimate driven, per Locked Logic §6, not actual time logged). This is a pure frontend computation over data the dashboards already fetch — no new backend endpoint needed.
* `TeamWorkloadTracker.jsx` (manager) now shows a per-employee "Today's Capacity" bar with an "Over Capacity" flag so a manager can redistribute/reschedule.
* `CreateTaskModal.jsx` (manager) previews the selected assignee's capacity impact — using `estimatedHours` + the new task — and shows an inline warning banner when the assignment would push them over capacity for the day (only when the due date is today, since V1 is single-day only; multi-day planning stays deferred to V2).
* Added Daily Working Hours / Break Hours fields to the Edit User form in `UsersTab.jsx` (SuperAdmin). The onboarding wizard (create flow) intentionally keeps using the schema defaults (8h/1h) to keep that multi-step form unchanged — capacity can be tuned afterward via Edit.

### Iteration 8b: Capacity Forecast — V2 Preview (2026-08-15)
* User-requested early look at V2 (originally deferred): a multi-day capacity view, on top of Iteration 8's single-day V1. Scoped down to a read-only forecast grid rather than full calendar planning — no rescheduling/drag-and-drop.
* Generalized `getEmployeeCapacity` in `Frontend/src/lib/taskHelpers.js` to take an optional `day` param (was hardcoded to today), and added `getCapacityForecast(employee, tasks, days, startDate)`, which repeats the same single-day math across a rolling window.
* Added `TeamCapacityForecast.jsx` (manager) — a new "Team Capacity Forecast" section below Team Workload & Pending Tasks: an employee × next-7-days grid, each cell shaded by planned/capacity ratio (over-capacity called out explicitly in destructive color; under-capacity is unshaded/light per Locked Logic §7 — a signal, not a verdict).
* `CreateTaskModal.jsx`'s capacity warning banner now checks the task's actual selected due date (via the generalized `getEmployeeCapacity`) instead of only firing when due date === today, and its copy names the specific day when it isn't today.
* Verified the date/capacity math directly against live seed data (temporary scripts, not committed) before and after wiring the UI — confirmed a task due a few days out is correctly picked up on its own forecast day and correctly excluded from "today," including under this project's IST dev timezone.

### Iteration 9: Productivity Signals (2026-08-15)
* Extended `getProgressReport` in `Backend/controllers/taskController.js`'s per-employee report with separate signals, kept apart per Locked Logic §11 (never combined into one score):
  - `dailyCompletionRate` / `assignedCompletionRate`, computed independently from the existing `completionRate` (now also exposed as `overallCompletionRate` — an explicitly derived summary, not the primary metric).
  - `dailyNewCount` / `dailyCarriedForwardCount` — carried-forward daily tasks are split out of the daily total instead of being counted as new (Locked Logic §8).
  - `plannedUtilizationPct` / `actualUtilizationPct` — two separate Capacity Utilization metrics for today (V1 single-day, consistent with Iteration 8), plus a distinct `isCapacityOverrunToday` boolean (Actual Capacity Overrun is its own signal, not folded into utilization).
  - `pendingBacklogAvgAgeDays` / `pendingBacklogOldestAgeDays`, via a new `getPendingAgeDays()` helper that reads the last transition into "Pending" from `task.history`.
* Enriched `EmployeeDrilldownModal.jsx` (SuperAdmin → Reports → Employees) with three new sections reading these fields directly off the existing report response: a Daily/Assigned/Overall completion-rate breakdown (with the new-vs-carried-forward note), a Today's Capacity panel (Planned vs Actual Utilization + Over Capacity flag), and a Pending Backlog panel (count/avg age/oldest age). The summary table itself (`EmployeesReport.jsx`) is left unchanged — signals live in the drill-down, matching the doc's summary-then-drill-down model (Locked Logic §12).
* Verified the new per-employee numbers directly against live task data (temporary script, not committed) before wiring the UI.

### Iteration 10: Estimation Pattern Detection (2026-08-15)
* Added pattern detection to `getProgressReport`'s per-employee report (`Backend/controllers/taskController.js`): the last `PATTERN_LOOKBACK` (5) completed + estimated tasks, most-recent-first, are checked for overrun; `hasOverrunPattern` flags true only when at least `PATTERN_MIN_SAMPLE` (3) samples exist AND more than `PATTERN_THRESHOLD` (50%) of them overran — small sample sizes are deliberately not flagged (verified against live data: an employee with a 50% overrun rate on only 2 completed tasks correctly stays unflagged).
* The underlying task-level data is always retained and returned (`recentEstimatedTasks`, per Locked Logic §10) — each entry has title, estimated/tracked hours, and overrun %, so a flagged pattern is always traceable to specific tasks, never just a bare percentage.
* `EmployeesReport.jsx` (SuperAdmin → Reports → Employees table) shows a small destructive "Pattern" badge next to a flagged employee's name — a summary-level signal, not a score.
* `EmployeeDrilldownModal.jsx` adds an "Estimation Pattern" section: a plain-language explanation of the flag (framed as worth investigating, explicitly not punitive) plus the list of the specific recent tasks behind it.

### Iteration 11: Manager Drill-Down Polish (2026-08-15)
* Fixed a scoping gap in `getProgressReport` (`Backend/controllers/taskController.js`): `/api/tasks/report` is role-gated to `manager`/`super_admin` but was building `employeeReport` from every active employee org-wide regardless of caller. Now a `manager` caller is scoped to `User.find({ ..., manager: req.user.id })` — their own direct reports only; `super_admin` is unaffected (still sees everyone). The `departmentReport`/`teamReport`/`healthReport`/`priorityReport` sections stay org-wide as before — only SuperAdmin's Reports tab consumes those; the new Manager-side panel only reads `employeeReport`. Verified against live data (temporary script, not committed): scoped correctly from 4 org-wide employees down to a specific manager's 2 direct reports.
* `useManagerDashboardStore.js`'s `loadData` now also fetches `/api/tasks/report` alongside tasks/users/departments/work-logs, stored as `report`.
* Added `TeamSignalsPanel.jsx` — a new "Employee Signal Summary" section on the Manager dashboard: one collapsed row per direct report (name + at-a-glance badges for Over Capacity / Pattern / Overdue), expanding to the full Task → Time → Capacity → Completion → Deadline → Quality → Pattern breakdown from Iterations 7-10, reading the same `employeeReport` fields the SuperAdmin drill-down uses. This closes the gap where those signals previously only existed in SuperAdmin's Reports tab, which managers don't have a route to.
* Added `buildEmployeeSignalSummary(r)` to `Frontend/src/lib/taskFormatters.js` — a deterministic (no LLM, no API cost) template function turning an `employeeReport` row into a plain-English narrative paragraph (e.g. "Maya has 12 tasks, 4 completed and 1 in progress... planned workload is almost at full capacity (96%), but actual utilization is currently very low (3%)..."), plus a shorter `headline` (the active warnings, or the task-count sentence if none) shown even while a `TeamSignalsPanel` row is collapsed. Verified the generated prose against live data (temporary script, not committed) — numbers and phrasing read correctly.

