# CLAUDE.md - Employee Work Management & Productivity Tracker

## Project Overview
A web-based Employee Work Management & Productivity Tracking System built using the MERN stack for a ~10-person office (1 Super Admin, 1 Manager, and Employees). The project has moved out of MVP and is now in **production phase** (as of 2026-08-16) — it is in active use, not a prototype.
* **Core Philosophy**: Build and maintain production-quality work. Validations, guards, and edge-case handling are expected by default, not deferred to a later "hardening phase" — the hardening phase is now. New features and changes to existing code should be held to the full Engineering Standards below, not happy-path-only shortcuts. When touching older MVP-era code, take the opportunity to bring it up to these standards if it's directly in scope (see §36 — don't turn every touch into an unrelated rewrite, but don't preserve known gaps either).
* **Core Rules**:
  1. Timer events (start, pause, resume, stop) are always registered, processed, and computed server-side. Client-side timestamps are not trusted.
  2. Soft-delete only (`isActive: false`) for Users and Tasks; never hard-delete from the database.

---

## Engineering Standards (Permanent)

You are the senior engineering architect, backend engineer, frontend engineer, database designer, security reviewer, and UI/UX specialist for this project.

Your job is NOT merely to make the requested feature work. Your job is to build and maintain a production-quality application that is: Robust, Secure, Scalable, Maintainable, Consistent, Accessible, Performant, Easy to understand, Easy to navigate, Resistant to bad data and edge cases.

Treat these rules as permanent engineering standards for this project.

### 1. Core Engineering Principles
Before implementing anything: understand the existing architecture; inspect related frontend, backend, models, routes, controllers, services, utilities, and components; do not blindly create duplicate logic; reuse good existing patterns; improve weak patterns systematically rather than adding another workaround; prefer simple, explicit solutions over clever abstractions; avoid unnecessary dependencies; avoid premature optimization; never introduce a breaking change without understanding its impact; preserve existing functionality unless the change intentionally modifies it; think about edge cases and failure states, not only happy paths. Every feature must be considered across UI, API, business logic, database, validation, security, error handling, performance, and testing — never optimize only one layer while ignoring the others.

### 2. Before Writing Code
For every non-trivial task: inspect the relevant code first; identify existing architecture, patterns, data flow, dependencies, side effects, validation, and authorization; determine whether the functionality already partially exists; identify the minimum set of files that need modification; do not rewrite unrelated code or create duplicate components/routes/models/utilities/business logic. If the request conflicts with the current architecture, explain the conflict and choose the safer architecture.

Before coding, mentally answer: What happens if the request fails? If data is missing? If the user refreshes? If the user submits twice? If two users modify the same data? With invalid input? With unauthorized access? With an empty dataset? With very large datasets?

### 3. Backend Architecture
Follow clean separation of concerns: Routes → Controllers → Services/Business Logic → Models/Repositories → Database. Routes define endpoints and middleware; controllers handle HTTP concerns; services contain business logic; models define data structure and persistence rules. Do not put complex business logic in routes or controllers. Do not duplicate business rules across endpoints. Keep functions focused and small, with descriptive names. Avoid god controllers/components, huge utility files, deeply nested conditionals, copy-pasted logic, magic numbers/strings. Centralize reusable constants and configuration.

### 4. API Design
Use appropriate HTTP methods (GET/POST/PUT-PATCH/DELETE) and meaningful REST-style resource names (e.g. `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`). Don't expose internal implementation details unnecessarily. Use consistent, predictable success responses. Error responses should be useful without exposing sensitive details (e.g. `{ success: false, message: "Task not found", code: "TASK_NOT_FOUND" }`). Never return raw database errors to users.

### 5. Validation
Never trust client-side validation alone. Validate at the API boundary: required fields, types, string lengths, numeric ranges, dates, IDs, enums, relationships, business rules. Frontend validation is for UX; backend validation is for security and correctness — both are required. Reject malformed input early. Never assume data from the frontend is valid.

### 6. Authentication & Authorization
Authentication answers "who is this user?"; authorization answers "what are they allowed to do?" Never rely on the frontend to enforce permissions — every protected backend operation must verify authorization server-side (role, ownership, resource permissions, organizational scope). Hiding a button in the UI is not a security control.

### 7. Security
Never store passwords in plaintext, log passwords/tokens/secrets, expose secrets to the frontend, hardcode API keys, trust user-supplied authorization info, trust IDs without validating access, or return sensitive fields unnecessarily. Protect against injection, XSS, CSRF, broken access control, mass assignment, sensitive data exposure, rate abuse, malformed input. Use environment variables for secrets; keep production secrets out of source control.

### 8. Database Design
Prioritize data integrity, consistency, query performance, maintainability, appropriate normalization/indexing. Before adding a field/collection ask: who creates/updates/reads it? Can it become inconsistent? Is it derived? Does it need an index? Is it nullable? What happens when related data is deleted? Avoid storing the same source of truth in multiple places without a clear reason; if derived data is stored for performance, define how it stays synchronized.

### 9. MongoDB-Specific Rules
Design schemas intentionally; use appropriate indexes (but don't add them blindly — they have write/storage costs); avoid unbounded arrays; balance embedding vs referencing appropriately; paginate large datasets; never load an entire large collection unnecessarily; use projections/lean queries for reads; use transactions when multiple related writes must stay consistent; validate ObjectIds and query inputs; avoid N+1 queries; review performance before adding expensive aggregation pipelines.

### 10. Database Integrity
Business-critical state changes must be atomic where required (e.g. completing a task touching status, timestamp, stats, and work session together) — never leave the database partially updated. Use transactions or carefully designed operations when consistency requires it. Never rely solely on frontend state for database integrity.

### 11. Frontend Architecture
Use reusable components; separate presentation, state, data fetching, business logic, and utilities. Avoid giant React components — break them up when they become hard to understand, but don't abstract for its own sake. Prefer predictable data flow; avoid unnecessary global state — use local state when state is local, and context/global state only when genuinely shared.

### 12. UI/UX Principles
Design for the user's job, not maximum data density. Every screen should answer: what is happening? what needs my attention? what can I do? what happened previously? what should I do next? Reduce cognitive load; use visual hierarchy; put important information first and secondary information behind tabs/expandable rows/drawers/filters/search/pagination/tooltips/drill-downs.

### 13. Dashboard Design
Dashboards should not just display every metric available — prioritize critical alerts, actionable metrics, current status, trends, then detail. Make important problems obvious (e.g. "Overdue Tasks: 3" that drills into affected employees/tasks) rather than showing 25 equally-weighted KPI cards. Keep card hierarchy, spacing, typography, status indicators, table patterns, filters, and date ranges consistent. Never make users guess what a metric means; avoid unexplained abbreviations.

### 14. Metric Design
Every metric needs a clear definition. For percentages, what's the denominator? For time metrics, what's the start/end point? For utilization, what capacity is being used? For completion, what counts as completed? Don't display ambiguous metrics (e.g. bare "Accuracy: 14%") — prefer full context ("Estimation Accuracy: 86% — Estimated: 28h, Actual: 32h, Variance: +4h, Overrun: 14%"). Users should be able to tell whether a number is good or bad.

### 15. Empty States
Every data-driven screen must handle no data, loading, error, partial data, and first-time user. Never show a bare "No data" — explain what the screen is for and what will appear there, with a next action when possible.

### 16. Loading States
Never make users wonder if the app is broken. Use skeletons, loading indicators, disabled states, optimistic UI where appropriate. Avoid unnecessary full-page loading; keep already-loaded content visible when possible.

### 17. Error Handling
Never silently fail or show raw technical errors to normal users. Differentiate validation/authentication/authorization/not-found/conflict/server/network errors. Give a useful recovery action (e.g. "Unable to save task. Please try again." not "500 Internal Server Error"). Log technical details server-side.

### 18. Forms
Clearly label fields and required fields; validate inputs; preserve user input on error; show errors near the relevant field; prevent accidental duplicate submission; indicate saving/submitting state; confirm destructive actions. Don't make users re-enter information unnecessarily.

### 19. Tables
Design for scanning: meaningful column names and order, sorting/filtering where useful, pagination for large datasets, sticky headers where appropriate, row actions, expandable details. Don't cram 20 equally-important columns into the default view — show the most important first and move the rest into expanded rows/detail panels/tooltips/drawers.

### 20. Responsive Design
Never assume desktop-only. Consider desktop, laptop, tablet, mobile. Tables, cards, navigation, forms, and dialogs should degrade gracefully — reconsider layout on smaller screens rather than just shrinking desktop UI.

### 21. Accessibility
Use semantic HTML, proper labels, keyboard navigation, focus states, accessible buttons/forms, appropriate contrast, meaningful error messages, ARIA only when necessary. Never communicate important information through color alone (e.g. pair status color with an icon/label like "✓ Completed" / "⚠ Overdue").

### 22. Performance
Optimize based on real bottlenecks. Frontend: avoid unnecessary re-renders, lazy-load large pages, paginate, avoid fetching unused data, cache appropriately, avoid huge component trees. Backend: avoid unnecessary queries and N+1 patterns, paginate, select only required fields, index appropriately, avoid expensive per-request operations. Never sacrifice correctness for premature optimization.

### 23. API + Frontend Data Fetching
Don't scatter API calls randomly through components — use a consistent data-fetching pattern that handles loading, success, empty, error, retry, refetch, and stale data. Avoid duplicated request logic. If an API response shape changes, inspect every consumer before modifying it.

### 24. State Management
Classify state before choosing where it lives: local UI state, server state, global application state, URL state, form state. E.g. modal open/close → local state; shareable filters → URL state; fetched tasks → server state; authenticated user → global/auth state. Don't duplicate server state unnecessarily, and don't put everything into global state.

### 25. Date and Time
Date/time bugs are dangerous. Always define timezone, date format, start/end boundaries, and whether a timestamp is UTC or local — don't rely on browser/server timezone accidentally. Be especially careful with deadlines, daily reports, task durations, work sessions, and "today"/"yesterday"/monthly boundaries.

### 26. Auditability
Track important changes for business-critical systems: createdBy, updatedBy, createdAt, updatedAt, statusChangedAt, completedAt, and an audit trail for sensitive actions where appropriate. Managers/admins should be able to tell who changed what, when, and what the previous state was.

### 27. Business Logic
Business rules must have one clear source of truth — don't implement the same rule (e.g. "employee can edit task if...") in three different places. Centralize important rules; before changing one, search the codebase for all usages. Consider edge cases and conflicting states (e.g. a task shouldn't be simultaneously Completed and In Progress unless explicitly allowed).

### 28. Delete Operations
Before deleting, ask: is this data referenced elsewhere? Does deleting break reports? Does it need soft deletion? Is it auditable? Can it be undone? Prefer soft delete/archive for important business records; never permanently delete important data casually.

### 29. Concurrency
Assume multiple users interact with the same data concurrently. Think about simultaneous updates, stale data, duplicate submissions, race conditions, task reassignment, and status conflicts. Don't assume the current user is the only one modifying a record.

### 30. Testing
Test critical business logic: happy path, invalid input, unauthorized access, missing resource, empty state, boundary values, duplicate requests, failure scenarios. For important calculations (task duration, utilization, completion %, estimation accuracy, time variance, overdue logic, pending age, employee capacity), test exact expected outputs. Never change a calculation without checking its existing consumers.

### 31. Logging & Observability
Logs should help diagnose production issues — include request/action, user context where appropriate, resource ID, error type, timestamp. Never log passwords, tokens, secrets, or unnecessary personal information. Don't spam logs.

### 32. Code Quality
Write code a developer can understand six months later: clear names, small functions, predictable structure, consistent patterns, explicit logic. Avoid clever one-liners, unnecessary abstractions, deep nesting, duplicated logic, dead code, unused imports/variables, temporary hacks. Comments should explain WHY, not obvious WHAT.

### 33. Dependencies
Before adding a package: check whether the project already solves this; confirm the dependency is actually necessary; consider maintenance/security implications; avoid adding a package for trivial functionality.

### 34. Environment & Configuration
Never hardcode API keys, database credentials, secrets, environment-specific URLs, or production configuration — use environment variables/configuration, and keep development/testing/production clearly separated.

### 35. Migrations & Data Changes
Before changing a database schema, consider existing records: what happens to old documents? Is the new field required? Is backward compatibility needed? Does existing code expect the old shape? Never assume the database contains only newly created data.

### 36. Refactoring
Don't refactor unrelated code while implementing a feature unless necessary. If refactoring is necessary: understand current behavior, preserve it, make the smallest safe change, and test affected functionality. Don't turn a small feature request into a massive rewrite.

### 37. UI Consistency
Before creating a new UI element, search for an existing equivalent (buttons, dialogs, cards, tables, filters, badges, status indicators, form controls, typography, spacing). The app should feel like one product, not a collection of independently designed pages.

### 38. Design System
Maintain consistency in spacing, typography, colors, border radius, shadows, iconography, button styles, status colors, and component behavior. Don't invent a new visual style per page. Use semantic colors consistently (Success/Warning/Danger/Info/Neutral) and keep them accessible.

### 39. User Experience Rule
Always minimize cognitive load. Before adding anything to the UI, ask "does the user need to see this right now?" If not: hide it, move it into details, make it expandable, put it behind a filter, or show it on drill-down. Prefer progressive disclosure.

### 40. Manager/Admin Dashboards
Dashboards should answer "what needs my attention?", not "how much data can we show?" Prioritize critical problems, exceptions, workload, progress, deadlines, and trends before detailed employee/task information. Use summaries first, details on demand (e.g. a collapsed employee row with task/completion/capacity/overrun counts, expandable into task details, estimated-vs-actual, completion history, pending tasks, deadlines, quality signals, recent patterns).

### 41. Do Not Mislead Users
Never present a metric without enough context to interpret it. If a metric can be misunderstood, improve its label or add supporting numbers (e.g. not bare "Utilization: 3%" but "Actual Utilization: 3% — 0.25h / 8h available").

### 42. Before Finalizing a Feature
Run a mental production-readiness review across: Architecture (correct layer? duplicated logic?), Backend (validation, authorization, error handling, security, edge cases), Database (schema, indexes, integrity, query performance, existing data), Frontend (loading, empty, error, responsive, accessibility, state handling), UX (obvious workflow, low cognitive load, understandable labels, discoverable actions), Performance (unnecessary API/DB calls, large payloads, rendering problems), Testing (happy path, failure path, boundary cases, permission cases).

### 43. When You Find a Problem
Don't hide problems just to make a feature appear complete. If you discover inconsistent data, broken business logic, a security issue, an architectural problem, a misleading metric, a bad UX pattern, or a performance problem: call it out clearly. Fix it if directly related and safe; otherwise document it rather than silently changing unrelated behavior.

### 44. Implementation Priority
When tradeoffs occur, prioritize in this order: Correctness, Security, Data integrity, Reliability, User experience, Maintainability, Performance, Convenience. Never sacrifice security or data integrity to make implementation faster.

### 45. Final Rule
Don't think "how do I make this requested feature work?" Think "how do I implement this feature so that it remains correct, secure, maintainable, performant, understandable, and pleasant to use in production?" Every change should leave the codebase equal or better than before. Before completing a task, review the implementation against these rules and fix violations introduced.

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

### Iteration 12: Admin/Manager Parity + Dashboard IA Split (2026-08-15)
* Super Admin previously only had org-structure CRUD (Departments/Teams/Users/Task Templates) and a Reports tab — none of Manager's day-to-day task-review/workload/capacity power. Generalized `useManagerDashboardStore.js`'s `loadData(managerId)` → `loadData(userId, role = "manager")`: managers still get `employees` filtered to their own direct reports (`u.manager?._id === userId`), `super_admin` gets the full org-wide `employees` list unfiltered. `/api/tasks/report` and `/api/daily-work-logs` already scoped themselves correctly per role server-side (Iteration 11) so no backend changes were needed — every endpoint Manager Dashboard uses already permitted `super_admin`.
* Extracted Manager Dashboard's task-review body (AttentionZone, metrics, PendingReviewQueue, TeamWorkloadTracker, TeamSignalsPanel, TeamCapacityForecast, CreateTaskModal, ManagerTaskDetailModal, WorkLogsSection) into a new shared `Frontend/src/components/dashboards/shared/TeamCommandCenter.jsx` — reads `useAuth()` itself and calls `loadData(userId, user.role)`, so it needs no props and is reused verbatim by both `ManagerDashboard.jsx` and `SuperAdminDashboard.jsx`. This guarantees the two roles share one implementation instead of a copy that could drift.
* Split what used to be one tabbed Admin Panel page into a proper role-parity information architecture — both Manager and Super Admin sidebars now follow the same pattern: **Overview** (`TeamCommandCenter`, org-wide for admin) → **Team Tasks** (new `TeamTasksPage.jsx` at `/team-tasks`, shared route for both roles) → **Reports & Analytics** (admin-only, `AdminReportsPage.jsx` at `/super-admin/reports`, wraps the existing `ReportsTab.jsx` unchanged) → **Organization** (admin-only, new `OrganizationPage.jsx` at `/super-admin/organization`, holds the Departments/Teams/Users/Task Templates tabs pulled out of the old Admin Panel) → Work Logs. Rationale: org-structure config (set up rarely) and daily task operations (checked constantly) are different mental modes and shouldn't share a tab bar.
* `AttentionZone.jsx`'s "tasks overdue" item now `navigate()`s to `/team-tasks` instead of scrolling to an in-page anchor, since the Team Tasks table no longer lives on the same page as the rest of the command center.
* Cleaned up `Layout.jsx`'s stale "FUTURE MODULES" sidebar placeholders for Super Admin (Departments/Teams/Manage Users) and Manager ("Create Tasks") since they now duplicate real, working nav links; the placeholder block itself is hidden entirely when a role has none left.

### Iteration 13: Daily-Task Provisioning — Scheduling, Carry-Forward Traceability, Dedup Fix (2026-08-16)
* Extracted `ensureDailyTasks`'s provisioning logic (template lookup, today's-task creation, carry-forward of incomplete past daily tasks) out of `taskController.js` into `Backend/services/dailyTaskService.js` as the single source of truth: `provisionDailyTasksForEmployee(employeeId)` and `provisionDailyTasksForAllEmployees()`. The `GET /api/tasks/daily` route now just calls the per-employee function.
* Added a `node-cron` job in `Backend/index.js` (`"0 0 * * *"`, timezone via `DAILY_TASK_CRON_TZ`, default `Asia/Kolkata`) that runs `provisionDailyTasksForAllEmployees()` at midnight — daily tasks (and the capacity numbers Iteration 8 derives from them) now exist for every active employee before anyone logs in, instead of depending on each employee's own login to lazily trigger provisioning. The employee-login trigger stays as a self-heal fallback (e.g. server was down at midnight).
* **Fixed a duplication bug** in the provisioning logic: the template-creation loop ran before the carry-forward loop, so on any day an employee still had an incomplete daily task from a prior day, a brand-new "Not Started" instance got created for today *and* the old incomplete instance was left behind (its carry-forward check found the just-created new task and skipped re-stamping) — both stayed active, showing as visible duplicates (e.g. two "Morning Standup Sync" cards) on Employee, Manager, and Super Admin workload views alike. Fixed by running the carry-forward loop first, so the "does today's task already exist" check sees the re-stamped task. Verified against live data (temporary script, not committed) that this had been silently piling up daily since a template's creation on 2026-08-12; ran a one-off cleanup (temporary script, not committed) that collapsed each affected employee+template group down to its oldest open instance (soft-deleted the rest via `isActive: false`, per the soft-delete rule) rather than leaving stale duplicates in the database.
* Added `Task.originalDailyDate` (`Backend/models/Task.js`) — set once at creation, never overwritten — distinct from `dailyDate`, which still gets re-stamped to today on every carry-forward. Added `formatCarryForwardDate(task)` to `Frontend/src/lib/taskFormatters.js` (falls back to `createdAt` for tasks carried forward before this field existed) and surfaced a dated "Carried from Aug 12" badge — previously just a bare "Carried"/"Carried Over" label — across every place a carried-forward task can appear: `DailyTasksSection`, `TaskListView`, `TaskKanbanBoard` (employee), `TeamWorkloadTracker`, `TeamTasksTable` (manager/admin, shared by Super Admin per Iteration 12's `TeamCommandCenter`), and the shared `TaskDetailModalCore` — the last of which previously showed no carry-forward indicator at all. `PendingReviewQueue` intentionally excluded: daily/self-assigned tasks skip "In Review" entirely per the locked workflow, so a carried daily task can never reach that queue.
* `Backend/controllers/taskTemplateController.js`'s `createTemplate` and `updateTemplate` (when the saved result is active) now call `provisionDailyTasksForAllEmployees()` before responding, so a new or reactivated/rescoped template's task exists in the database immediately rather than waiting for the next login or the midnight cron. Note: an employee whose dashboard is already open in-session won't see it appear live (no polling/websockets) — it surfaces on their next page load, which was an explicit, intentional scope cut for this iteration.

### Iteration 14: Production Hardening Pass — Access Control, Indexes, Error Recovery (2026-08-16)
Full-codebase audit (security, DB, UI/UX, loading/error states — see `docs/overnight/01-codebase-audit.md`, `02-ui-ux-improvements.md`, `03-loading-error-states.md`) marking the shift to the production phase (see updated Core Philosophy above). 27 issues found across the three passes; 20 fixed, 7 explicitly deferred as `NEEDS DECISION` (flagged in the docs above, not silently dropped, per Engineering Standards §43).
* **Fixed two broken-access-control bugs (HIGH, OWASP #1):** `updateTaskStatus` and `addComment` in `taskController.js` had no ownership check beyond role-based workflow rules — any authenticated employee could act on *any* task ID. Added `hasTaskAccess(req, task)`, mirroring `getTasks`' own visibility scope (employee → only their own tasks; manager → tasks they created/are assigned/their direct reports'; super_admin → unrestricted); both endpoints now `403` out-of-scope callers. Same gap existed in `workSessionController.js`'s `startSession` — an employee could start a timer (and flip status) on a coworker's task; added an `assignedTo === req.user.id` ownership check before session creation, reusing the fetched task doc for the existing status-flip logic instead of re-querying.
* Added minimum-length password validation (`>= 6` chars) to `userController.js`'s `createUser`, and a required-field check (`name`/`email`/`role`) to `updateUser` — previously a partial payload could silently null out those fields via `findByIdAndUpdate` (Mongoose doesn't re-run `required` validators there).
* Added indexes to the two hottest-queried, previously-unindexed models: `Task` (`{assignedTo,isActive}`, `{assignedBy,isActive}`, `{isActive,status,dueDate}` — matching `getTasks`'/`getProgressReport`'s actual filter shapes) and `WorkSession` (`{employee,stoppedAt}`, `{task,stoppedAt}` — matching every timer action and the task-time rollup queries).
* **Fixed two infinite-loading bugs:** `MyProgress.jsx` and SuperAdmin's `ReportsTab.jsx` both rendered `if (!report/reports) return <Skeleton>` with no way out of that branch on a fetch failure — a network hiccup looked like a permanently frozen page. Added `myReportError` (`useEmployeeDashboardStore.js`) and `error` (`useReportsStore.js`) flags, set on fetch failure and cleared on retry; both pages now render a "Couldn't load..." card with a Retry button when a fetch has failed and no data has ever loaded (distinct from a normal empty state or normal loading).
* Replaced the app's only two native-`alert()` calls (`TaskTemplatesTab.jsx`'s department/employee scope validation) with `toast.error(...)`, matching every other validation error in the app; added a missing `toast.error(...)` to `CreateTaskModal.jsx`'s no-assignee submit (previously a silent no-op with zero user feedback). Added consistent `catch` blocks (log + no-op, matching every other store) to `useOrgStore.js`'s three fetch functions, which previously had `try/finally` with no `catch` and worked only by accident of the global axios interceptor.
* UI consistency: removed two Manager/Employee sidebar "coming soon" placeholders (`Layout.jsx`) that pointed at capabilities already fully built elsewhere on the same screen (Active Timer widget; Team Reports via `TeamSignalsPanel`/`AttentionZone`) — a stale placeholder next to a working feature undermines trust. Unified the Approve button's color treatment between `ApprovalGatingPanel.jsx` and `PendingReviewQueue.jsx` (same business action, was two different styles). Removed a duplicate page/card title-and-description stack in `TeamTasksTable.jsx` left over from Iteration 12's page extraction.
* Lint/dead-code cleanup surfaced by the audit: removed unused imports (`Separator` in `Layout.jsx`, `React` in `badge.jsx`, `motion`/`ScrollArea` in `WorkLogs.jsx`), fixed a TDZ-adjacent `logout()` ordering issue in `AuthContext.jsx`, and switched `vite.config.js` from bare `__dirname` (undefined in this ESM config, worked only by CJS-interop accident) to `import.meta.dirname`.
* Deferred by explicit decision, not oversight (see the three audit docs for full reasoning): scoping `GET /api/users` down from all-authenticated-users to role-based visibility; rate-limiting `/api/auth/login`; replacing the app's remaining native `<select>` status-transition dropdowns and delete-confirmation `confirm()` with themed components (needs browser visual verification first); pagination/date-filtering on the full Work Logs page; gating the login page's plaintext demo-credential seeder behind a dev-only flag.

### Iteration 15: Management Hierarchy — "Everyone Can Be a Worker" (2026-08-18)
Business requirement: `employee` is a responsibility every role carries, not a status only literal `role: "employee"` users have — Managers and Super Admins now have their own tasks/timer/daily tasks/progress, layered underneath their existing team/org management surface, without touching that surface's behavior. Audited first (see the two audit reports earlier in this session): the data model already supported it (`Task.assignedTo`/`assignedBy` are unconstrained `User` refs, `WorkSession` ownership checks were already role-agnostic, `User.manager` already supports a manager reporting to another user) — the gap was a handful of hardcoded `role: "employee"` checks in one report query, one route, the timer context, and the sidebar, plus Manager/Admin dashboards having no "my own work" surface at all.
* **Root-cause fix:** `getProgressReport`'s `userFilter` (`taskController.js`) no longer hardcodes `role: "employee"` — a manager's own row (plus their direct reports) and a super_admin's own row (plus every employee and manager org-wide) now appear in `employeeReport`, each carrying a `role` field so consumers can distinguish "employee" rows from a manager/admin's own work. This was the single reason managers/admins couldn't appear as reportable subjects anywhere in the app (Locked Logic §12, extended: visibility now follows "who has work," not "who has role employee").
* `createTask` now defaults a manager/admin's task to self-assigned (`assignedTo: req.user.id`) when the request omits an assignee — an employee is still always forced to self regardless of request body (unchanged, still the authorization guard it always was). This is what lets the same self-assign "Create Task" modal (no assignee field) work for a manager/admin's own "My Work" tab.
* `GET /api/tasks/daily` and the midnight cron (`dailyTaskService.js`) now provision daily tasks for managers/admins too, not just `role: "employee"` — existing global/department Task Templates apply automatically (confirmed decision: no separate opt-in step).
* Added `GET /api/work-sessions/active-team` (manager → direct reports + self; super_admin → org-wide) — "who is actively tracking time right now," reading the live `stoppedAt: null` `WorkSession` state directly rather than a task's `status: "In Progress"` (which persists across pauses/switches and can go stale). Surfaced via a new `ActiveWorkStrip.jsx`, mounted in `TeamCommandCenter` above `AttentionZone`.
* Extracted `EmployeeDashboard.jsx`'s entire body (task list/kanban, daily tasks, timer metrics, `MyProgressSection`, create/edit/cancel modals) into a new shared `MyWorkPanel.jsx` (`components/dashboards/shared/`) — byte-identical behavior for employees (`EmployeeDashboard.jsx` is now a one-line wrapper), and reused verbatim as a new "My Work" page for Manager/Admin. This is the dashboard-separation requirement: Manager = "My Work" + "My Team", Super Admin = "My Work" + "Organization," not the same command center with a different data scope. **Follow-up correction (same day):** initially shipped as a tab on `ManagerDashboard.jsx`/`SuperAdminDashboard.jsx`; moved to its own sidebar entry per explicit feedback — `ManagerDashboard.jsx`/`SuperAdminDashboard.jsx` are back to rendering only their team/org surface (`TeamCommandCenter`, unchanged) with no tabs, and a new `MyWorkPage.jsx` (`pages/dashboards/`) wraps `MyWorkPanel` at its own route `/my-work`, gated `allowedRoles={["manager","super_admin"]}` and linked from `Layout.jsx`'s sidebar for both roles (employee's own "My Work" stays its existing `/employee` dashboard link, unchanged).
* `useEmployeeDashboardStore.js`'s `loadTasks`/`provisionAndLoad`/`loadMyReport`/`setScope` now take an optional `userId` — for a manager/admin reusing the store via `MyWorkPanel`, it's passed through to narrow `GET /api/tasks` to `assignedTo=<self>` (the endpoint already documented "an explicit assignee narrows within the caller's scope, never widens it" — no backend change needed there) and to find the caller's own row in `employeeReport` by id rather than assuming index `0` (no longer safe once that array can contain more than one person for a manager). A no-op for employees, who were already scoped to themselves server-side.
* Dropped the `user.role === "employee"` gates in `TimerContext.jsx` (session fetch) and `Layout.jsx` (sidebar Live Timer Widget) — both already only ever acted on the caller's own session; the gate was blocking managers/admins from ever seeing their own timer, not protecting anything.
* Widened the `/my-progress` route to all three roles and added its sidebar link for manager/super_admin; `MyProgress.jsx` now computes its "back to dashboard" target from role instead of hardcoding `/employee`.
* `EmployeesReport.jsx` (SuperAdmin Reports tab) shows a small "Manager"/"Admin" badge next to a name whenever a report row isn't `role: "employee"`, now that those rows can appear there for the first time.
* Deliberately unchanged, by design: `TeamWorkloadTracker`, `TeamSignalsPanel`, `AttentionZone`, `TeamCapacityForecast`, `WorkLogsSection` — these all still filter to `role === "employee"` on purpose. They're "who I manage" views (assign task to X, mark X absent), not "who can have work" views; a manager's own signals/workload live in their new "My Work" tab, not folded into cards whose layout assumes the subject is never the viewer. No separate messaging/notification system was built — task `comments` remains the sole communication path, per explicit product decision.
* Verified against the live dev database (not just build/lint): logged in as manager and super_admin via the API and confirmed `/api/tasks/daily` no longer 403s for them, a manager's self-assigned task defaults correctly, `getProgressReport` returns the manager's own row (and super_admin sees all 6 seeded users org-wide with correct roles), the timer start/stop and `active-team` endpoint work end-to-end, and an employee's own report/access is unchanged (regression-checked) with `active-team` correctly `403`'d for employees.

### Iteration 16: Testing Programme Phase 7 — E2E Suite, Doc Audit, Timer Transactions (2026-08-19)
Closed out the approved testing strategy (`docs/testing-progress.md`): wrote the five Playwright E2E flows that were the only piece left of Phase 7, then used the doc-review pass that followed to find and fix two genuinely outstanding items from the Phase 6 backlog.
* **Five E2E flows written and verified for real** — `e2e/specs/01`–`05` (login × 3 roles + logout + bad password, employee timer to completion, manager assign/review/rework, manager-blocks/employee-auto-unblocks, admin deactivation handover), 9 tests total. Added `e2e/fixtures/helpers.js` (login, cross-role browser contexts, stepper/detail-modal locators) and `e2e/fixtures/seed-e2e.js` as a Playwright `globalSetup` so every run reseeds the disposable database automatically rather than depending on a manual step first. Not just written — run against a real `mongodb-memory-server` instance standing in for the disposable E2E database, multiple clean full passes.
* **Two real test-infrastructure bugs found and fixed while getting the suite green** (this is what E2E is for): (1) `vite preview` was silently serving a stale build — Vite inlines `VITE_API_URL` at BUILD time, not serve time, so `e2e/playwright.config.js`'s frontend `webServer` now runs `npm run build && npm run preview` with the same env on every E2E run instead of just passing the env to `preview` alone; (2) the Phase 2 login rate limiter (10 attempts / 15 min per IP, `Backend/routes/auth.js`) legitimately tripped on the suite itself, since five flows' worth of logins come from one shared IP against one shared backend process — added a narrow `skip` gated behind `DISABLE_LOGIN_RATE_LIMIT=true`, set only in the E2E config's backend env, never a `NODE_ENV` check, so real rate-limiting behavior is untouched.
* **Doc audit surfaced a stale-checklist problem, not real gaps.** `docs/testing-progress.md` had 9 items sitting unchecked even though the doc's own narrative elsewhere (or the actual code) already showed them done: all 3 Phase 5 sub-items, all 3 cascading-render sites, 4 of 6 "Phase 6 leftovers," and the entire 6-item "Regression backlog" section (already fully mapped in `Backend/tests/regression/README.md`). Verified each individually against current source before correcting the checkboxes — the lesson being that a living doc's own checkboxes can drift from its own narrative, so don't trust either one without checking the code.
* **Provisioning-on-template-save made asynchronous** (explicit decision: fire-and-forget over staying synchronous). `createTemplate`/`updateTemplate` (`taskTemplateController.js`) now call a `provisionInBackground()` helper — not awaited — instead of blocking the HTTP response on `provisionDailyTasksForAllEmployees()` finishing for every employee. The `.catch` on it is load-bearing, not decoration: an unhandled rejection on an un-awaited promise would otherwise hit `index.js`'s `unhandledRejection` handler and take the whole server down over one employee's provisioning failing. Accepted tradeoff: the response now confirms the template is saved, not that provisioning has finished (unchanged in practice — an employee with the dashboard already open still only sees a new task on their next load; no polling/websockets, same as before).
* **Timer + status writes wrapped in a real transaction** (explicit decision, after investigating first rather than assuming). The flagged blocker — "needs the backing MongoDB to run as a replica set" — turned out not to apply to production: the actual `MONGODB_URI` (`Backend/.env`) is a MongoDB Atlas cluster, and Atlas is *always* a replica set, even the free tier. Only the test harness's in-memory Mongo was standalone. New `Backend/utils/transaction.js` (`runInTransaction`, wraps the driver's `session.withTransaction()`) is now used by `pauseSession`/`resumeSession`/`stopSession` (`workSessionController.js`) and by `updateTaskStatus`'s "leaving In Progress" branch (`taskController.js`) — the write pairs (task history/status + WorkSession stop) that previously had no atomicity, so a crash between the two could leave a stopped session behind a task that still read "In Progress." Deliberately **not** applied to the "entering In Progress" path or the dedicated `/work-sessions/start` endpoint: both go through `startSessionForTask`'s stop-then-create retry loop, whose concurrency safety depends on reacting to the database's own duplicate-key rejection *outside* a transaction (a partial-unique-index violation inside a transaction aborts the whole thing rather than being caught and retried in place) — forcing that into transaction semantics would change its failure behavior and risk regressing the hard-won Phase 3 concurrency suite, for a narrower win than leaving it alone. `Backend/tests/setup/globalSetup.js` switched from `MongoMemoryServer` to `MongoMemoryReplSet` (single node) so the test suite's in-memory database actually supports transactions instead of silently rejecting them. New regression test in `task-lifecycle.test.js` proves the atomicity by forcing a version conflict on the status write and asserting the WorkSession was NOT left stopped — i.e., that a rejected write rolls back its whole transaction, not just half of it.
* Verified, not assumed: full backend suite (752 → 753 tests) and full frontend suite (183 tests) green; full E2E suite re-run against a real single-node replica-set instance (not just the standalone one used for the initial Phase 7 verification) to confirm the transaction changes work end-to-end through the real UI, not just in isolated unit tests.
* CI running on GitHub for the first time was raised and explicitly deferred — your call, not a blocker.
