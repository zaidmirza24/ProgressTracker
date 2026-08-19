# Architecture Overview

This document describes the high-level architecture of the ProgressTracker application — a MERN-stack Employee Work Management & Productivity Tracker for a ~10-person office (Super Admin, Manager, Employees).

---

## Architecture Blueprint

```text
React Component (Frontend UI)
       │ (Zustand stores / React Context / local state)
       ▼
Axios HTTP Requests (shared instance, Bearer JWT header, 15s timeout)
       │ (JSON payload over HTTP)
       ▼
Express Route (role-gated via authenticateJWT / requireRole)
       │
       ▼
Express Controller (asyncHandler-wrapped; validation + business logic)
       │
       ▼
Mongoose Model (Backend/models/)
       │
       ▼
MongoDB Database
```

---

## Subsystems

### 1. Frontend Architecture
* **Technology**: React 19 (Vite), React Router v7, Zustand v5, Axios, Tailwind CSS v4, Radix UI primitives (shadcn pattern), `motion` (Framer Motion, imported as `"motion/react"`), Recharts, lucide-react icons.
* **Entry point**: `Frontend/src/main.jsx` mounts `<App />`.
* **Provider nesting** (`App.jsx`): `ErrorBoundary` → `ThemeProvider` → `ToastProvider` → `AuthProvider` → `BrowserRouter`. `TimerProvider` wraps only the protected shell (`Layout`), not the public `/login` route.
* **Routing**: role-gated via `ProtectedRoute allowedRoles={[...]}` per route (see [codebase-map.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/codebase-map.md) for the full route table). `HomeRedirect` sends an authenticated user to their role's default dashboard.
* **State management** — classified per Rule #24:
  * **Server state** (fetched from the API): Zustand stores, one per dashboard/feature area (`useManagerDashboardStore`, `useEmployeeDashboardStore`, `useReportsStore`, `useOrgStore`, `useTaskTemplatesStore`).
  * **Global app state**: React Context — `AuthContext` (current user/token), `ThemeContext` (dark/light, persisted), `TimerContext` (the employee's live work-timer state machine), `ToastContext` (global notifications + the shared axios error interceptor).
  * **Local/UI state**: plain `useState` inside components (modal open/close, form fields, search inputs).
* **Styling**: Tailwind v4 utility classes + custom CSS variables/keyframes in `App.css`/`index.css` (dark-first "Fordark" theme, shimmer skeletons, glow/pulse effects).

### 2. Backend Architecture
* **Technology**: Node.js + Express, ES Modules (`"type": "module"`).
* **Entry point**: `Backend/index.js` — CORS (explicit origin allowlist), JSON body parsing, Mongoose connection, router mounting, health-check routes, 404 catch-all, global error handler, process-level crash guards (`uncaughtException`, `unhandledRejection`).
* **Layering**: Routes (`Backend/routes/`) → Controllers (`Backend/controllers/`, every handler wrapped in `asyncHandler`) → Mongoose Models (`Backend/models/`). No separate service layer yet — controllers currently hold business logic directly; `taskController.js` is the largest and most business-logic-heavy file (task workflow, reporting/analytics aggregation).
* **Config**: `Backend/config/workflow.js` centralizes the task-status state machine (`WORKFLOW_RULES`, `isValidTransition`) — the single source of truth for what status transitions each role/ownership combination may make (Rule #27).
* **Environment**: `.env` via `dotenv` — `MONGODB_URI`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `NODE_ENV`.

### 3. Database Architecture
* **Technology**: MongoDB via Mongoose. Seven active models: `User`, `Department`, `Team`, `Task`, `TaskTemplate`, `WorkSession`, `DailyWorkLog`. Full field-level reference in [database.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/database.md).
* **Soft-delete only**: every model that supports deactivation uses `isActive: false`; nothing is hard-deleted (Core Rule #2).

### 4. Authentication & Authorization Architecture
* **Auth**: Stateless JWT. `POST /api/auth/login` signs a 1-day token containing only `{ id, role }`. The frontend's `AuthContext` persists the token to `localStorage`, attaches it as `Authorization: Bearer <token>` on the shared axios instance, and re-verifies it against `GET /api/auth/me` on load.
* **Authorization**: `Backend/middleware/authMiddleware.js` — `authenticateJWT` validates the token and sets `req.user`; `requireRole([...])` is applied per-route where a hard role boundary exists (e.g. all of `/api/task-templates`, `POST`/`PUT` on Departments/Teams/Users). Some endpoints (`PUT /api/tasks/:id/status`, `POST /api/tasks/:id/comments`) deliberately have no route-level `requireRole` — authorization is enforced inside the controller instead (e.g. via `isValidTransition`), because the valid action set depends on task ownership, not just role. The frontend never enforces permissions on its own — hiding a button is UX, not security (Rule #6).

### 5. Timer / Work Session Architecture
* Exactly one active `WorkSession` per employee at a time, enforced server-side: starting a new session automatically stops whichever one was running (Core Rule #1, Locked Logic §2).
* All elapsed-time math happens server-side from `startedAt`/`events`/`totalSeconds` — the frontend's `TimerContext` only ticks a display-only local clock; every actual value comes from a server response, and every mutation (`start`/`pause`/`resume`/`stop`) is optimistic-then-reconciled (patch locally, call the API, replace with the server's authoritative response, roll back on failure).
* Pausing, resuming, or stopping a session also drives the linked task's `status` (into/out of `Pending`/`In Progress`) as a side effect — this is the one place task status changes without going through `isValidTransition`, since it's system-driven rather than a user choosing a transition.

### 6. Role-Parity Dashboard Architecture
* Manager and Super Admin share one implementation of "day-to-day task command center" functionality: `Frontend/src/components/dashboards/shared/TeamCommandCenter.jsx` is rendered verbatim by both `ManagerDashboard.jsx` and `SuperAdminDashboard.jsx`, backed by the same `useManagerDashboardStore` (its `loadData(userId, role)` scopes `employees` to a manager's own direct reports, or org-wide for `super_admin` — everything else in the component is role-agnostic).
* Both roles' sidebars follow the same information-architecture pattern, split by usage cadence rather than feature area: **Overview** (daily task review) → **Team Tasks** (shared route, both roles) → **Reports & Analytics** / **Organization** (admin-only, config/analytics screens used far less often) → **Work Logs**. See [decisions.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/decisions.md) items 6–7.

---

## UI/Aesthetic Patterns

* **Form fields & navigation**: Radix UI primitives (via `Frontend/src/components/ui/`) replace native HTML controls — selects, dialogs, tabs, dropdowns — for consistent styling and accessibility.
* **Skeleton shimmer loading**: adaptive CSS loading skeletons render initial layouts during active REST fetches (Rule #16 — never leave the user wondering if the app is broken).
* **Optimistic UI**: the shared `useTaskStatusMutation` hook and `TimerContext`'s timer actions both patch local state immediately, then reconcile with (or roll back to) the server's response — used consistently across Employee and Manager/Admin task views so status changes and timer actions feel instant.
* **Toasts & error surfacing**: `ToastContext` installs a global axios response interceptor so most API errors surface as a toast automatically, without each call site handling it individually; 401s are passed through silently for `AuthContext` to handle (token expiry → logout).

---

## Data Flow

1. **User interaction** in a React component (`Frontend/src/`).
2. **State/store action** — either a local `setState`, a Zustand store action, or a Context method (e.g. `TimerContext.pauseTimer()`).
3. **API call** via the shared axios instance (`API_BASE` from `Frontend/src/lib/api.js`), `Authorization` header already attached.
4. **Route → middleware → controller** on the Express server: `authenticateJWT` → (optional) `requireRole` → `asyncHandler`-wrapped controller function, which validates input, applies business rules (often consulting `config/workflow.js` for task-status changes), and touches Mongoose.
5. **Response**: JSON back to the client; the store/component updates state, optimistic patches are reconciled or rolled back, and React re-renders.
