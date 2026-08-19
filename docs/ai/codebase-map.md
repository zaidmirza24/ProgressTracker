# Codebase Map

This document outlines the layout of the repository to help AI agents find and edit the correct files quickly.

---

## 1. Server Setup & Entry

* **Backend entry**: [Backend/index.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/index.js) — Express config, CORS, JSON parsing, Mongo connection, router mounting, health routes, error handling, process crash guards.
* **Backend env**: [Backend/.env](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/.env) — `MONGODB_URI`, `JWT_SECRET`, `PORT`, `CLIENT_URL`.
* **Seed script**: [Backend/seed.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/seed.js) — demo data (1 Super Admin, 1 Manager, 8 Employees + departments/teams/tasks).
* **Frontend entry**: [Frontend/src/main.jsx](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/main.jsx) mounts `<App />`; [Frontend/src/App.jsx](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Frontend/src/App.jsx) owns provider nesting + routing.

---

## 2. Backend Structure (`Backend/`)

### `models/` — Mongoose schemas
`User.js`, `Department.js`, `Team.js`, `Task.js`, `TaskTemplate.js`, `WorkSession.js`, `DailyWorkLog.js`. Full field reference: [database.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/database.md).

### `routes/` — Express routers, mounted in `index.js`
| Mount path | File | Notes |
|---|---|---|
| `/api/auth` | `auth.js` | login (public), `/me` |
| `/api/departments` | `departmentRoutes.js` | CRUD, super_admin writes |
| `/api/teams` | `teamRoutes.js` | CRUD, super_admin writes |
| `/api/users` | `userRoutes.js` | CRUD, super_admin writes |
| `/api/tasks` | `taskRoutes.js` | list/create/status/comments/report/daily |
| `/api/task-templates` | `taskTemplateRoutes.js` | full CRUD, super_admin only |
| `/api/work-sessions` | `workSessionRoutes.js` | timer start/pause/resume/stop |
| `/api/daily-work-logs` | `dailyWorkLogRoutes.js` | list (role-scoped)/create (employee) |

Full endpoint-by-endpoint reference: [api.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/api.md).

### `controllers/`
`authController.js`, `departmentController.js`, `teamController.js`, `userController.js`, `taskController.js` (largest — task CRUD, status transitions, `ensureDailyTasks`, the `getProgressReport` analytics aggregate), `taskTemplateController.js`, `workSessionController.js` (timer semantics, elapsed-time calculation), `dailyWorkLogController.js`.

### `middleware/`
`authMiddleware.js` (`authenticateJWT`, `requireRole`), `errorMiddleware.js` (global error handler — dev vs. prod error shapes).

### `config/`
`workflow.js` — `WORKFLOW_RULES` + `isValidTransition`, the single source of truth for task-status transition rules per role/ownership.

### `utils/`
`asyncHandler.js` (async route wrapper), `appError.js` (`AppError` operational-error class).

---

## 3. Frontend Structure (`Frontend/src/`)

```text
src/
├── App.jsx, App.css, index.css, main.jsx
├── components/
│   ├── ErrorBoundary.jsx, Layout.jsx, ProtectedRoute.jsx
│   ├── ui/            — shadcn/Radix primitives (avatar, badge, button, card, dialog,
│   │                     dropdown-menu, input, label, scroll-area, select, separator,
│   │                     skeleton, table, tabs, textarea)
│   ├── tasks/          — cross-role task detail/creation building blocks
│   └── dashboards/
│       ├── shared/     — TeamCommandCenter.jsx (Manager + Admin Overview, see below)
│       ├── manager/    — Manager/Admin command-center sections
│       ├── employee/   — Employee-only dashboard sections
│       └── superadmin/ — org-config screens + Reports
├── context/            — AuthContext, ThemeContext, TimerContext, ToastContext
├── hooks/               — useTaskStatusMutation.js
├── lib/                 — api, taskConstants, taskFormatters, taskHelpers, stepper, utils
├── store/               — Zustand stores (one per dashboard/feature area)
└── pages/
    ├── Login.jsx, WorkLogs.jsx, MyProgress.jsx
    └── dashboards/      — one page per route (see routing table below)
```

### `pages/dashboards/` — route-level pages
* `SuperAdminDashboard.jsx` — Admin **Overview**: org pulse strip + `TeamCommandCenter`.
* `ManagerDashboard.jsx` — Manager's page header + `TeamCommandCenter`.
* `EmployeeDashboard.jsx` — Employee's own dashboard (daily tasks, kanban/list toggle, attention strip, timer panel).
* `TeamTasksPage.jsx` — standalone "Team Tasks Tracker" table, shared route for both `manager` and `super_admin`.
* `AdminReportsPage.jsx` — wraps `ReportsTab.jsx`, admin-only.
* `OrganizationPage.jsx` — Departments/Teams/Users/Task Templates tabs, admin-only.
* `Unauthorized.jsx` — role-mismatch fallback.

### Routing table (`App.jsx`)
| Path | Page | `allowedRoles` |
|---|---|---|
| `/login` | `Login` | public |
| `/unauthorized` | `Unauthorized` | public |
| `/` | `HomeRedirect` (inline) | any authenticated → routes to role's default |
| `/super-admin` | `SuperAdminDashboard` | `super_admin` |
| `/super-admin/reports` | `AdminReportsPage` | `super_admin` |
| `/super-admin/organization` | `OrganizationPage` | `super_admin` |
| `/manager` | `ManagerDashboard` | `manager` |
| `/team-tasks` | `TeamTasksPage` | `manager`, `super_admin` |
| `/employee` | `EmployeeDashboard` | `employee` |
| `/my-progress` | `MyProgress` | `employee` |
| `/work-logs` | `WorkLogs` | `employee`, `manager`, `super_admin` |
| `*` | → `/` | — |

All protected routes render inside `ProtectedRoute` → `TimerProvider` → `Layout` (the sidebar shell).

### `components/dashboards/shared/`
* **`TeamCommandCenter.jsx`** — the task-review/workload/capacity/signals body rendered by *both* Manager and Admin Overview (no props; reads `useAuth()` + `useManagerDashboardStore` itself). Renders: header + Create Task button → `AttentionZone` → 4 metric cards → `PendingReviewQueue` → `TeamWorkloadTracker` → `TeamSignalsPanel` → `TeamCapacityForecast` → `CreateTaskModal` + `ManagerTaskDetailModal` (modals) → `WorkLogsSection`. Owns the shared `useTaskStatusMutation` instance passed into the review/table components below it. See [decisions.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/decisions.md) item 6 for why this is one component, not two.

### `components/dashboards/manager/`
`AttentionZone.jsx` (live needs-attention summary, links/navigates into the relevant section), `CreateTaskModal.jsx` (assign-to-employee, capacity-impact preview), `PendingReviewQueue.jsx` (In Review approve/reject), `TeamCapacityForecast.jsx` (7-day capacity grid, V2 preview), `TeamSignalsPanel.jsx` (expandable per-employee Task→Time→Capacity→Completion→Deadline→Quality→Pattern narrative), `TeamTasksTable.jsx` (full searchable task table — rendered on `TeamTasksPage`, not inside `TeamCommandCenter`), `TeamWorkloadTracker.jsx` (per-employee workload cards + capacity bar), `WorkLogsSection.jsx` (filterable work-log table).

### `components/dashboards/employee/`
`CreateTaskModal.jsx` (self-assign), `DailyTasksSection.jsx`, `MyProgressSection.jsx` (dashboard-embedded summary, links to `/my-progress`), `NeedsAttentionStrip.jsx`, `TaskKanbanBoard.jsx`, `TaskListView.jsx`.

### `components/dashboards/superadmin/`
`DepartmentsTab.jsx`, `TeamsTab.jsx`, `TaskTemplatesTab.jsx` (all CRUD tables + dialogs, backed by `useOrgStore`/`useTaskTemplatesStore` — rendered inside `OrganizationPage.jsx`), `OrgPulseStrip.jsx` (Overview's one-glance health strip, shares `useReportsStore` with Reports so numbers always agree).
* **`ReportsTab/`** (rendered by `AdminReportsPage.jsx`): `ReportsTab.jsx` (shell — timeframe filter, sub-tab switcher), `EmployeesReport.jsx`, `DepartmentsReport.jsx` / `TeamsReport.jsx` (thin wrappers around `EntityReportTable.jsx`), `AnalyticsReport.jsx` (Recharts), `InsightsReport.jsx` (narrative cards), `EmployeeDrilldownModal.jsx` (per-employee deep dive).
* **`UsersTab/`**: `UsersTab.jsx`, `OnboardingWizard.jsx` (multi-step create-user with inline dept/team creation), `roleConstants.js`.

### `components/tasks/` — shared task-detail building blocks
`TaskDetailModalCore.jsx` (shared modal core — header, info grid, tabs, comments), `EmployeeTaskDetailModal.jsx` / `ManagerTaskDetailModal.jsx` (role-specific entry-point wrappers around the core), `ApprovalGatingPanel.jsx` (manager-only approve/rework), `TaskTimerPanel.jsx` (employee-only timer controls), `TaskFormFields.jsx` (shared `CategorySelect`/`PrioritySelect`/`HoursAndDueDateRow`, extracted since Manager's and Employee's create-task forms needed them byte-for-byte identical).

### `store/` — Zustand
* `useManagerDashboardStore.js` — `{ tasks, employees, departments, workLogs, report, loading }`; `loadData(userId, role="manager")` scopes `employees` to direct reports for `manager`, org-wide for `super_admin`.
* `useEmployeeDashboardStore.js` — `{ tasks, todayHours, loading, myReport }`; `provisionAndLoad()` (daily-task provisioning then load), `loadMyReport()`.
* `useReportsStore.js` — `{ reports, loading, activeSubTab, timeframe, startDate, endDate, selectedEmployee }`; `fetchReports()` drives `GET /api/tasks/report` with a computed date range.
* `useOrgStore.js` — `{ departments, teams, users, ...Loading }`; CRUD actions plus `createDepartmentInline`/`createTeamInline` for the onboarding wizard.
* `useTaskTemplatesStore.js` — `{ templates, departments, loading }`; CRUD, each mutation refetches templates.

### `context/`
* `AuthContext.jsx` — `user`, `token`, `login()`, `logout()`; sets the axios auth header and verifies via `/api/auth/me` on load.
* `ThemeContext.jsx` — dark/light, persisted to `localStorage`, toggles a `dark` class on `<html>`.
* `TimerContext.jsx` — `activeSession, elapsedSeconds, isRunning`; optimistic `startTimer/pauseTimer/resumeTimer/stopTimer`, each reconciled with (or rolled back from) the server response.
* `ToastContext.jsx` — global toast stack + the shared axios response interceptor (surfaces most API errors automatically; 401 passed through for `AuthContext` to handle).

### `hooks/`
`useTaskStatusMutation.js` — `{ updateStatus(taskId, status, comment) }`, the one shared optimistic task-status mutation used across Employee/Manager/Admin task views.

### `lib/`
`api.js` (`API_BASE`), `taskConstants.js` (`STATUS_VARIANTS`, `PRIORITY_VARIANTS`, `PROGRESS_FOR_STATUS`, `CATEGORY_PRESETS`), `taskFormatters.js` (date/time/hours formatting, `formatOverrun`, `buildEmployeeSignalSummary` — deterministic template, no LLM), `taskHelpers.js` (`getEmployeeCapacity`, `getCapacityForecast`, `isTaskOverdue`, `getNextStatuses(ForManager)`), `stepper.js` (workflow-stepper step lists), `utils.js` (`cn`, `extractErrorMessage`).

---

## 4. Key Dependencies (`Frontend/package.json`)
React 19, `react-router-dom` v7, `zustand` v5, `axios`, `motion` (Framer Motion, imported as `"motion/react"`), `recharts`, Tailwind CSS v4, `lucide-react`, Radix UI primitives, `class-variance-authority` / `clsx` / `tailwind-merge` (shadcn convention). Dev: Vite, ESLint.
