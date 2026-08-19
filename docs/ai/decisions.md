# Architectural Decisions

This document logs key architectural decisions made for the ProgressTracker repository.

---

## 1. Split Client/Server Codebases
* **Decision**: Separate client and server code into standalone directories (`Frontend/` and `Backend/`).
* **Rationale**: Keeps dependencies isolated, makes deployment configuration flexible, and provides a clear boundary between UI presentation and API services.

## 2. Backend ES Modules
* **Decision**: Use ES Modules (`import`/`export`) in the Node.js Express backend via `"type": "module"` in `package.json`.
* **Rationale**: Aligns backend JavaScript syntax with modern frontend React standards, making coding patterns consistent across the whole repository.

## 3. Styling via Tailwind CSS & Vanilla CSS
* **Decision**: Combine Tailwind CSS v4 utility classes with standard Vanilla CSS declarations inside (`index.css`, `App.css`).
* **Rationale**: Tailwind CSS v4 provides rapid utility-first UI development and standardizes responsive layouts, while Vanilla CSS manages global theme variables (e.g., dark theme oklch tokens), custom keyframe animations (floating glows, pulse rings), and custom element scrollbars.

## 4. Choice of Tech Stack
* **Decision**: Adopt the standard MERN stack with Express and Mongoose.
* **Rationale**: Simplifies modeling and route handlers with standard, well-supported libraries (`mongoose`, `express`).

## 5. Centralized Backend Error Handling
* **Decision**: Standardize on `AppError` class, `asyncHandler` route wrapper, and global Express error middleware.
* **Rationale**: Prevents try-catch duplication across controller code, catches unhandled exceptions globally, ensures database/JWT token validation errors are returned as structured JSON, and cleanly intercepts port conflicts.

## 6. Manager/Admin Share One Dashboard Implementation
* **Decision**: Super Admin's task-review/workload/capacity/signals functionality is not a re-implementation of Manager's — both roles render the same `Frontend/src/components/dashboards/shared/TeamCommandCenter.jsx`, backed by the same `useManagerDashboardStore.js` (generalized to take a `role` so `super_admin` sees org-wide data instead of a manager's own direct reports).
* **Rationale**: Two roles with overlapping-but-not-identical power are a common source of copy-paste drift (a fix or new signal added to one dashboard silently missing from the other). A single shared component with role-scoped data removes that class of bug entirely, at the cost of the component needing to stay role-agnostic (no hardcoded "manager"-only copy or logic).

## 7. Sidebar Pages Split by Cadence, Not by Feature Area
* **Decision**: Admin Panel's information architecture separates screens by how often they're used rather than by what they configure: `Overview` and `Team Tasks` (checked constantly) are separate sidebar pages from `Organization` (Departments/Teams/Users/Task Templates — configured rarely) and `Reports & Analytics`.
* **Rationale**: Bundling daily-operations screens and one-time-setup screens into the same tab bar forces users to mentally filter out whichever mode they're not currently in. Splitting by cadence keeps each page's tab bar focused on one mental mode.

## 8. Task Detail Modal Split by Role, Not by One Shared Prop-Heavy Component
* **Decision**: The original single `TaskDetailModal.jsx` (branching internally on role) was replaced with `TaskDetailModalCore.jsx` (shared header/info-grid/comments) plus thin `EmployeeTaskDetailModal.jsx` / `ManagerTaskDetailModal.jsx` entry-point wrappers, and the role-specific action areas were pulled out into their own self-contained components: `ApprovalGatingPanel.jsx` (manager-only approve/rework) and `TaskTimerPanel.jsx` (employee-only start/pause/resume/stop).
* **Rationale**: A single modal branching on `role` inside its own body accumulates conditional rendering that's easy to break for one role while editing the other's flow. Each wrapper only receives the props relevant to that role (e.g. the employee modal never sees `updateTaskStatus` for approvals), which makes it structurally impossible to wire a manager-only action into the employee view by mistake.

## 9. Duplicate Form Fields Extracted Only Once They Were Byte-Identical
* **Decision**: `CategorySelect`, `PrioritySelect`, and `HoursAndDueDateRow` were extracted into `Frontend/src/components/tasks/TaskFormFields.jsx` and shared between Manager's and Employee's separate `CreateTaskModal.jsx` components, rather than merging the two modals into one.
* **Rationale**: The two create-task forms diverge in real ways (state-lifting for "assign to employee" pre-fill, manager-only Assignee/Department fields, the capacity-warning banner) — collapsing them into one component would reintroduce role-branching complexity for no benefit. Pulling out only the parts that were genuinely identical avoided duplication without forcing an unnatural merge (Rule #36 — don't turn a small dedupe into a bigger rewrite than the problem calls for).
