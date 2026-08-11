# API Reference

This document lists the existing API endpoints for the ProgressTracker backend.

---

## Base Configuration
* **Server Protocol**: HTTP (or HTTPS in production)
* **Base URL**: Set via `process.env.PORT` on the backend (e.g. `http://localhost:5000` or the configured port).
* **Format**: All payloads and responses are formatted as JSON.

---

# API Reference

This document lists the active API endpoints for the ProgressTracker backend.

## Base Configuration
* **Server Protocol**: HTTP
* **Base URL**: `http://localhost:3000` (or `process.env.PORT` target)
* **Format**: All payloads and responses are formatted as JSON.

---

## 1. System Endpoints

### Health Check / Status
* **Method**: `GET`
* **Path**: `/`
* **Purpose**: Verifies that the API server is online.
* **Authentication**: None
* **Response**: `{"status": "ok", "message": "API is running"}`

### Render Platform Keep-Alive
* **Method**: `GET`
* **Path**: `/health`
* **Purpose**: Lightweight keep-alive endpoint for external uptime monitors. Has no DB queries or middleware checks.
* **Authentication**: None
* **Response Status**: `200 OK`
* **Response**: `{"status": "ok"}`

### API Detailed Health Status
* **Method**: `GET`
* **Path**: `/api/health`
* **Authentication**: None
* **Response**: `{"status": "ok", "message": "Employee Work Management API is running", "timestamp": "ISO_DATE_STRING"}`

---

## 2. Authentication

### User Login
* **Method**: `POST`
* **Path**: `/api/auth/login`
* **Request Body**: `{"email": "sales@tradex.com", "password": "password123"}`
* **Response (Success)**: `{"token": "JWT_TOKEN", "user": {"id": "...", "name": "...", "email": "...", "role": "..."}}`

### Current Profile Check
* **Method**: `GET`
* **Path**: `/api/auth/me`
* **Authentication**: Required (`Bearer JWT_TOKEN`)
* **Response**: User profile metadata with populated department and team.

---

## 3. Administration & HR

### Departments (Active)
* **GET `/api/departments`**
  * Authentication: Required (Any role)
  * Action: Returns list of active departments.
* **POST `/api/departments`**
  * Authentication: Required (`super_admin` only)
  * Action: Creates a new department.
* **PUT `/api/departments/:id`**
  * Authentication: Required (`super_admin` only)
  * Action: Updates name or description.

### Teams (Active)
* **GET `/api/teams`**
  * Authentication: Required (Any role)
  * Action: Returns list of active teams.
* **POST `/api/teams`**
  * Authentication: Required (`super_admin` only)
  * Action: Creates a team under a department.
* **PUT `/api/teams/:id`**
  * Authentication: Required (`super_admin` only)
  * Action: Updates name, description, or department.

### Users (Active)
* **GET `/api/users`**
  * Authentication: Required (Any role)
  * Action: Returns list of users.
* **POST `/api/users`**
  * Authentication: Required (`super_admin` only)
  * Action: Adds a user (Manager/Employee) with department, team, and manager associations.
* **PUT `/api/users/:id`**
  * Authentication: Required (`super_admin` only)
  * Action: Modifies user status, info, or assignments.

---

## 4. Tasks

* **GET `/api/tasks`**
  * Authentication: Required (Any role)
  * Action: Gets tasks. If role is `employee`, returns tasks assigned to them; if `manager`, returns tasks they assigned or assigned to their department; if `super_admin`, returns all.
* **POST `/api/tasks`**
  * Authentication: Required (`manager`, `super_admin`, or `employee` role)
  * Action: Creates a task with title, category, priority, estimated hours, and due date.
* **PUT `/api/tasks/:id/status`**
  * Authentication: Required (Any role)
  * Action: Transitions task status and adjusts `progressPercentage` automatically.
* **POST `/api/tasks/:id/comments`**
  * Authentication: Required (Any role)
  * Action: Appends feedback comment on the task.

---

## 5. Work Sessions & Timers

* **GET `/api/work-sessions/active`**
  * Action: Returns the current active timer session for the user, if any.
* **GET `/api/work-sessions/today-hours`**
  * Action: Computes total work duration tracked today (in decimal hours).
* **POST `/api/work-sessions/start`**
  * Request: `{"taskId": "..."}`
  * Action: Creates and starts a new session timer.
* **POST `/api/work-sessions/pause`**
  * Action: Appends a pause event to freeze the session.
* **POST `/api/work-sessions/resume`**
  * Action: Appends a resume event.
* **POST `/api/work-sessions/stop`**
  * Action: Commits stop time and writes total duration.

---

## 6. Daily Work Logs

* **GET `/api/daily-work-logs`**
  * Action: Returns employee work reports.
* **POST `/api/daily-work-logs`**
  * Authentication: Required (`employee` only)
  * Request Body: `{"todaysWork": "...", "hoursWorked": 8, "problemsFaced": "...", "nextPlan": "..."}`
  * Action: Logs standard end-of-day office report.
