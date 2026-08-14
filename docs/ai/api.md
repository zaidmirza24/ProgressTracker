# API Reference

This document lists the active API endpoints for the ProgressTracker backend, as currently implemented.

---

## Base Configuration
* **Server Protocol**: HTTP
* **Base URL**: `http://localhost:3000` (or `process.env.PORT`); frontend reads it from `VITE_API_URL` via `Frontend/src/lib/api.js`, falling back to the same default.
* **Format**: All payloads and responses are JSON.
* **Auth header**: `Authorization: Bearer <JWT>`, set automatically by the frontend's `AuthContext` on the shared axios instance.
* **CORS**: allowlisted origins only (`http://localhost:5173`, `http://localhost:4173`, `process.env.CLIENT_URL`), credentials enabled; requests with no `Origin` header (curl, server-to-server) are always allowed.
* **Error shape**: In production, operational errors return `{ status, error: message }`; unexpected errors return a generic 500 without leaking internals. In development (`NODE_ENV` unset), full error/stack detail is returned. See `Backend/middleware/errorMiddleware.js`.

---

## 1. System Endpoints

* **`GET /`** — Health check, unauthenticated. `{"status": "ok", "message": "API is running"}`
* **`GET /health`** — Lightweight uptime-monitor endpoint, no DB query, unauthenticated. `{"status": "ok"}`
* **`GET /api/health`** — Detailed health status, unauthenticated. `{"status", "message", "timestamp"}`

---

## 2. Authentication — `/api/auth` ([auth.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/auth.js))

* **`POST /api/auth/login`** — no auth required. Body: `{ email, password }`. Validates against `passwordHash` via bcrypt, signs a 1-day JWT containing `{ id, role }` only. Response: `{ token, user: { id, name, email, role } }`.
* **`GET /api/auth/me`** — auth required (any role). Returns the caller's full profile (minus `passwordHash`). Used by `AuthContext` on load/refresh to verify the stored token and hydrate `user`.

---

## 3. Departments — `/api/departments` ([departmentRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/departmentRoutes.js))

All routes require auth.
* **`GET /`** — any role. Lists active departments, sorted by name.
* **`POST /`** — `super_admin` only. Body: `{ name, description }`.
* **`PUT /:id`** — `super_admin` only. 404 if not found.

## 4. Teams — `/api/teams` ([teamRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/teamRoutes.js))

All routes require auth.
* **`GET /`** — any role. Lists active teams, populates department name.
* **`POST /`** — `super_admin` only. Body: `{ name, department, description }`.
* **`PUT /:id`** — `super_admin` only. 404 if not found.

## 5. Users — `/api/users` ([userRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/userRoutes.js))

All routes require auth.
* **`GET /`** — any role. Lists active users (`name email role department team manager isActive createdAt dailyWorkingHours breakHours`), populated, sorted by role then name.
* **`POST /`** — `super_admin` only. Body: `{ name, email, password, role, department, team, manager, dailyWorkingHours?, breakHours? }`. Password is bcrypt-hashed (cost 10).
* **`PUT /:id`** — `super_admin` only. Updates profile/assignment/capacity fields. Does not update password. 404 if not found.

## 6. Task Templates — `/api/task-templates` ([taskTemplateRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/taskTemplateRoutes.js))

Entire router gated to auth + `requireRole(["super_admin"])`.
* **`GET /`** — lists active templates, populates `departments` and `createdBy`.
* **`POST /`** — Body: `{ title, description?, category?, priority?, estimatedHours?, scope?, departments? }`. `departments` is dropped unless `scope === "department"`.
* **`PUT /:id`** — partial update (only fields present in body are applied).
* **`DELETE /:id`** — soft-delete (`isActive: false`).

---

## 7. Tasks — `/api/tasks` ([taskRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/taskRoutes.js))

All routes require auth.

* **`GET /`** — any role, response scoped server-side: `employee` → own assigned tasks only; `manager` → tasks they assigned, tasks assigned to them, or tasks assigned to their direct reports; `super_admin` → all active tasks org-wide. Each task is returned with `totalTrackedSeconds` and overrun fields (`timeVarianceSeconds`, `overrunPercentage`, `isOverrun`) attached from `WorkSession` data.
* **`GET /daily`** — `employee` only. Idempotent: provisions today's Daily Task instances from active `TaskTemplate`s (global, or matching the employee's department) if not already created, and carries forward yesterday's incomplete daily tasks (`isCarryForward: true`, re-stamped to today). Returns `{ success, message }` — caller must re-fetch via `GET /`.
* **`GET /report`** — `super_admin`, `manager`, `employee`. The main analytics/signals aggregate; see §8 below. Optional `?startDate&endDate` (`YYYY-MM-DD`) filters most sections by task `createdAt`/`dailyDate`; overdue counts are always computed unfiltered ("always current").
* **`POST /`** — `manager`, `super_admin`, `employee` (effectively all roles). Body: `{ title, description?, category?, department?, assignedTo, priority?, estimatedHours?, dueDate? }`. If the caller is an `employee`, `assignedTo` is force-set to themself server-side regardless of what's sent.
* **`PUT /:id/status`** — no route-level role gate; authorization happens inside the controller via `isValidTransition` (see §9). Body: `{ status, comment? }`. Appends a `history` entry; on entering/leaving `"In Progress"`, also starts/stops the employee's own `WorkSession` for that task as a side effect.
* **`POST /:id/comments`** — no route-level role gate, any authenticated user who can reach the task may comment (no ownership check). Body: `{ text }`.

### 8. `GET /api/tasks/report` response shape

`employee` role receives `{ employeeReport }` only (their own single-row array — no org-wide data leaks to employees). `manager`/`super_admin` receive the full shape:

```
{
  employeeReport: [{
    employeeId, name,
    total, completed, inProgress, pending, overdue, totalTrackedSeconds, avgProgress, completionRate,
    tasks: [{ _id, title, description, category, priority, status, progressPercentage,
               estimatedHours, totalTrackedSeconds, dueDate, createdAt }],
    avgResolutionDays, estimationAccuracy,

    // Locked Logic §7/§8 — completion tracked separately, never combined
    dailyCompletionRate, dailyNewCount, dailyCarriedForwardCount,
    assignedCompletionRate, assignedTotal,
    overallCompletionRate,          // derived summary, explicitly secondary

    // Locked Logic §6/§7 — capacity, V1 single-day scope
    capacityHoursToday,             // dailyWorkingHours - breakHours
    plannedUtilizationPct, actualUtilizationPct,   // two separate metrics, never merged
    isCapacityOverrunToday,         // distinct signal from utilization %

    // Locked Logic §8 — pending backlog age
    pendingBacklogAvgAgeDays, pendingBacklogOldestAgeDays,

    // Locked Logic §10 — estimation pattern (never punitive, always traceable)
    hasOverrunPattern, recentOverrunProportion,
    recentEstimatedTasks: [{ title, estimatedHours, trackedHours, overrunPercentage, isOverrun }]
  }],
  departmentReport: [{ deptId, name, total, completed, inProgress, overdue, totalTrackedSeconds, completionRate, memberCount }],
  teamReport: [ /* same shape as departmentReport, per team */ ],
  healthReport: { totalTasks, completedTasks, inProgressTasks, notStartedTasks, overdueTasks,
                   pendingTasks, inReviewTasks, totalTrackedSeconds, avgCompletionRate },
  priorityReport: [{ priority, total, completed, overdue }]   // one row per high/medium/low
}
```

`employeeReport` scoping: `manager` sees only their own direct reports; `employee` sees only themself; `super_admin` sees every active employee org-wide. Pattern detection (`hasOverrunPattern`) requires ≥3 recent estimated+completed tasks AND >50% of them overran — small sample sizes are deliberately never flagged.

### 9. Task status workflow — `Backend/config/workflow.js`

Canonical 5-state flow: `Not Started → In Progress → Pending → In Review → Completed`.

| Actor | Not Started → | In Progress → | Pending → | In Review → | Completed → |
|---|---|---|---|---|---|
| Employee, self-assigned (daily/self-created) | In Progress | Pending, **Completed** | In Progress | — | — |
| Employee, manager-assigned | In Progress | Pending, **In Review** | In Progress | — | — |
| Manager / Super Admin | In Progress | Pending, In Review, Completed | In Progress | Completed, In Progress (rework) | In Progress (reopen for correction) |

Employees can complete self-assigned work directly; manager-assigned work must route through `In Review` for approval (Locked Logic §3). Only manager/super_admin can reopen a `Completed` task. `Pending` is never chosen manually — it's driven automatically by the timer (pause/switch-task/stop in `workSessionController.js`, which bypasses `isValidTransition` entirely since it's a system-driven transition, not a user-role one).

---

## 10. Work Sessions & Timers — `/api/work-sessions` ([workSessionRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/workSessionRoutes.js))

All routes require auth only (no role gate — scoping is implicit via `req.user.id`). Exactly one active session per employee is enforced server-side (Core Rule #1 / Locked Logic §2): starting a new session auto-stops any other active one for that employee.

* **`GET /active`** — returns `{ session, elapsedSeconds, isRunning }` (nulls if none).
* **`GET /today-hours`** — sums today's sessions (stopped + live-calculated active) into decimal hours.
* **`POST /start`** — Body: `{ taskId }`. Stops any other active session first; flips the target task to `In Progress` if it was `Not Started`/`Pending`.
* **`POST /pause`** — no-ops if already paused; freezes elapsed time, flips task to `Pending`. Never requires a reason.
* **`POST /resume`** — no-ops if already running; flips task back to `In Progress`.
* **`POST /stop`** — freezes the session, flips task to `Pending`. Returns `{ success, message }` (no session object).

---

## 11. Daily Work Logs — `/api/daily-work-logs` ([dailyWorkLogRoutes.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/routes/dailyWorkLogRoutes.js))

All routes require auth.
* **`GET /`** — role-scoped: `employee` → own logs only; `manager` → subordinates' logs (`?employee=` filter validated against the subordinate set — silently returns `[]` rather than erroring if the queried employee isn't a subordinate); `super_admin` → all logs, optional `?employee=` filter. Sorted by date/createdAt descending.
* **`POST /`** — `employee` only. Body: `{ todaysWork, hoursWorked, tasksCompleted?, problemsFaced?, nextPlan?, remarks? }`.
