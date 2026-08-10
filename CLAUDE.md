# CLAUDE.md - Employee Work Management & Productivity Tracker

## Project Overview
An MVP-first web-based Employee Work Management & Productivity Tracking System built using the MERN stack for a ~10-person office (1 Super Admin, 1 Manager, and Employees).
* **Core Philosophy**: Fast, happy-path-only development for MVP stages. Avoid adding elaborate validations, guards, or edge cases until the hardening phase.
* **Core Rules**:
  1. Timer events (start, pause, resume, stop) are always registered, processed, and computed server-side. Client-side timestamps are not trusted.
  2. Soft-delete only (`isActive: false`) for Users and Tasks; never hard-delete from the database.

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

