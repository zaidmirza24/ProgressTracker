# Workstream 1 — Full Codebase Audit + Safe Improvements

Scope: Backend (Express/Mongoose) + Frontend (React) + Database schema/query patterns.
This is an already well-structured codebase (clean controller/route separation, centralized
error handling, centralized workflow rules, no dead files, no console.log noise in the
frontend). The audit below reflects that — most findings are small and targeted rather than
systemic.

## Security

| Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|
| `Backend/controllers/taskController.js` — `updateTaskStatus`, `addComment` | No ownership/authorization check beyond role-based workflow rules. Any authenticated employee could call `PUT /api/tasks/:id/status` or `POST /api/tasks/:id/comments` with **any** task ID — including tasks belonging to other employees — and the request would succeed as long as the requested status transition was valid for their role. | Broken access control (OWASP #1). An employee could change another employee's task status or post comments on tasks they have no relation to. Violates CLAUDE.md Authorization rule ("every protected backend operation must verify authorization server-side"). | Added `hasTaskAccess(req, task)` helper mirroring `getTasks`' visibility scope (employee → only own tasks; manager → tasks they created, tasks assigned to them, or tasks assigned to their direct reports; super_admin → unrestricted). Both endpoints now return `403` if the caller is out of scope. | FIXED | HIGH |
| `Backend/controllers/workSessionController.js` — `startSession` | No check that the `taskId` being started belongs to the authenticated employee. An employee could start a timer (and flip status to "In Progress") on a coworker's task. | Timer events are meant to be trustworthy, server-computed records tied to the correct employee/task (CLAUDE.md core rule #1) — this let an employee corrupt another employee's task state and time-tracking data. | Added a task lookup + `assignedTo === req.user.id` check before creating the session; reused the same task doc for the later status-flip logic instead of re-querying. | FIXED | HIGH |
| `Backend/controllers/userController.js` — `createUser` | No minimum password length check. | Weak/empty passwords accepted for real login credentials. | Added a `password.length < 6` check (matches the "MVP, minimal validation" philosophy — not full password policy). | FIXED | MEDIUM |
| `Backend/controllers/userController.js` — `updateUser` | No required-field check — `name`/`email`/`role` could be blanked out via a partial payload missing those keys (Mongoose won't re-validate `required` on `findByIdAndUpdate` without `runValidators`). | A malformed request could silently null out a user's name/email/role. | Added a `name`/`email`/`role` required check before the update, consistent with `createUser`'s existing pattern. | FIXED | MEDIUM |
| `Backend/routes/userRoutes.js` — `GET /api/users` | Any authenticated user (including plain employees) can list **all** users org-wide (name, email, role, manager, department/team). Only mutations are role-gated. | Broader data exposure than an employee strictly needs (email addresses, full org hierarchy). | Not changed — the frontend legitimately needs this for assignee/manager dropdowns in multiple places (task creation, org pages), and several components may rely on it. Restricting it risks breaking a currently-working flow without full consumer analysis. | NEEDS DECISION | LOW |
| Login endpoint (`Backend/controllers/authController.js`) | No rate limiting / brute-force throttling. | Repeated password guesses aren't slowed down. | Not changed — would require a new dependency (e.g. `express-rate-limit`) or custom in-memory limiter, which is a real behavior change to auth and out of scope for a "safe fix." | NEEDS DECISION | MEDIUM |

## Database / Query Performance

| Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|
| `Backend/models/Task.js` | No indexes, despite `getTasks` filtering every request by `{ assignedTo, isActive }` / `{ assignedBy, isActive }`, and `getProgressReport`'s overdue query filtering by `{ isActive, status, dueDate }`. | These are the hottest read paths in the app; a full collection scan on every task list load doesn't matter at 10 users but is a correctness-free, zero-risk win. | Added `{ assignedTo, isActive }`, `{ assignedBy, isActive }`, and `{ isActive, status, dueDate }` indexes. | FIXED | LOW |
| `Backend/models/WorkSession.js` | No indexes, despite every timer action (`start`/`pause`/`resume`/`stop`/`active`) querying `{ employee, stoppedAt: null }`, and task-time rollups querying `{ task, stoppedAt }` in bulk. | Same as above — cheap, safe win on the single most frequently hit model (every timer click). | Added `{ employee, stoppedAt }` and `{ task, stoppedAt }` indexes. | FIXED | LOW |

## Code Quality

| Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|
| `Frontend/src/context/AuthContext.jsx` | `logout()` was called inside a `.catch()` handler before being declared later in the same component function (TDZ-adjacent pattern; ESLint flagged it as "accessed before declared"). Worked at runtime only because the callback runs after the component body finishes, but was fragile and lint-failing. | Confusing to read, and breaks `npm run lint` cleanly passing. | Moved the `logout` declaration above the `useEffect` that references it; removed the now-duplicate second declaration. | FIXED | LOW |
| `Frontend/src/components/Layout.jsx` | Unused import `Separator` from `@/components/ui/separator`. | Dead import, lint error. | Removed. | FIXED | LOW |
| `Frontend/src/components/ui/badge.jsx` | Unused `import * as React from "react"` (JSX runtime is automatic; `React` was never referenced). | Dead import, lint error. | Removed. | FIXED | LOW |
| `Frontend/src/pages/WorkLogs.jsx` | Unused imports `motion` (from `motion/react`) and `ScrollArea`. | Dead imports, lint error. | Removed. | FIXED | LOW |
| `Frontend/vite.config.js` | Used bare `__dirname`, which is undefined in this project's ESM Vite config and is flagged by both ESLint (`no-undef`) and Vite itself as unsupported by the upcoming native config loader. | Config loads today only by accident of Vite's current CJS interop; the project's own tooling is warning it will break. | Switched to `import.meta.dirname` (Vite's documented replacement). | FIXED | LOW |
| Frontend ESLint: `react-hooks/set-state-in-effect` (9 occurrences — `AuthContext`, `TimerContext`, `WorkLogs`, `EmployeeDashboard`) | The installed `eslint-plugin-react-hooks` version flags any `setState` call made synchronously inside a `useEffect` body (including the extremely common "fetch on mount, setState in `.then`" pattern used consistently across this codebase). | Not a functional bug — this is the standard, working data-fetch-on-mount pattern used everywhere in the app. "Fixing" it per the new lint rule's suggested approach (event-based data sync / effect events) would mean restructuring core data-loading logic in 4+ files, which is a real behavior-risk refactor, not a safe cleanup. | Left as-is. | NOT FIXED (by design) | LOW |
| Frontend ESLint: `react-refresh/only-export-components` (6 occurrences — `badge.jsx`, `button.jsx`, `AuthContext`, `ThemeContext`, `TimerContext`, `ToastContext`) | Context files exporting both the Provider component and a `useX()` hook (and `badge.jsx`/`button.jsx` exporting variant helpers alongside the component) trips Vite's Fast Refresh boundary rule. | Purely a dev-experience lint rule (affects only Fast Refresh smoothness, not production behavior or correctness). Fixing it means splitting each context into a component file + a hook file — a mechanical but broad refactor touching every consumer's import path. | Left as-is — flagged for a deliberate follow-up pass, not attempted tonight given the "don't make risky changes for the sake of it" instruction. | NOT FIXED (by design) | LOW |
| Frontend ESLint: `react-hooks/exhaustive-deps` (6 occurrences — `DepartmentsTab`, `ReportsTab`, `TaskTemplatesTab`, `TeamsTab`, `UsersTab`, `WorkLogs`) | Mount-time `useEffect(() => { fetchX() }, [])` effects don't list `fetchX` in the dependency array. | These functions are recreated every render (not memoized with `useCallback`), so adding them to the deps array as-is would cause an infinite fetch loop — the omission is intentional today, not an oversight. | Left as-is — a correct fix requires wrapping each fetch function in `useCallback`, which is a broader change than "safe cleanup" territory for a single overnight pass. | NOT FIXED (by design) | LOW |
| `Frontend/package.json` — `react-is` dependency | Listed as a direct dependency but has no direct import anywhere in `src/`. | Possible unused dependency. | Not removed — `recharts` (also in this project) uses `react-is` internally and version-pins can matter for React 19 compatibility; removing it risks a build break that wouldn't be visible until a clean `node_modules` install. | NEEDS DECISION | LOW |

## Architecture / General

No duplicate business logic, no duplicate components, no orphaned/unused files were found
(checked every `.jsx`/`.js` file under `Frontend/src` for at least one cross-reference).
Backend routes consistently gate mutations with `requireRole`; `errorMiddleware.js` correctly
distinguishes dev vs. prod error responses and never leaks stack traces in production. The
`dailyTaskService.js` carry-forward/dedup logic (Iteration 13) was re-read and confirmed
correct — no regressions found.

## Summary

- Issues found: 13
- Issues fixed: 8
- Issues not fixed: 5 (3 by design — see notes; 2 marked NEEDS DECISION below)
- Needs my decision: 3 — (1) whether to scope `GET /api/users` down from "all authenticated users" to role-based visibility, (2) whether to add rate limiting to `/api/auth/login`, (3) whether `react-is` can be safely dropped from `package.json` (would need a clean-install test)
- Important notes: The two HIGH-severity findings (task status/comment ownership bypass, timer-start ownership bypass) were real broken-access-control bugs, not stylistic issues — verified by reading the route files to confirm no ownership check existed anywhere in the request path. Both are fixed and build/syntax-checked. Frontend build (`npm run build`) and backend syntax checks pass after all changes.
