# Database Documentation

This document describes the database layer of the application as it currently exists in the codebase.

---

## Configuration & Connection

* **Database Engine**: MongoDB
* **ODM**: Mongoose
* **Connection**: Established in [Backend/index.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/index.js) via `process.env.MONGODB_URI` (falls back to `mongodb://localhost:27017/progresstracker` if unset).
* **Delete policy**: Soft-delete only — every model with an `isActive` flag is deactivated (`isActive: false`), never removed from the collection. See [decisions.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/decisions.md).

---

## Active Database Models

All models live in [Backend/models/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models). All six have Mongoose timestamps (`createdAt`/`updatedAt`) enabled.

### 1. User
[User.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/User.js)
* `name` (String, required, trimmed)
* `email` (String, required, unique, lowercase, trimmed)
* `passwordHash` (String, required)
* `role` (String, enum: `["super_admin", "manager", "employee"]`, default: `"employee"`)
* `department` (ObjectId, ref: `"Department"`, default: `null`)
* `team` (ObjectId, ref: `"Team"`, default: `null`)
* `manager` (ObjectId, ref: `"User"`, default: `null`) — self-referential; this is the field that scopes a manager's dashboard to their direct reports
* `isActive` (Boolean, default: `true`) — soft-delete
* `dailyWorkingHours` (Number, default: `8`) — capacity planning (Locked Logic §6)
* `breakHours` (Number, default: `1`) — capacity planning; `dailyWorkingHours - breakHours` = daily capacity

### 2. Department
[Department.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Department.js)
* `name` (String, required, trimmed)
* `description` (String, default: `""`, trimmed)
* `isActive` (Boolean, default: `true`)

### 3. Team
[Team.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Team.js)
* `name` (String, required, trimmed)
* `department` (ObjectId, ref: `"Department"`, required)
* `description` (String, default: `""`, trimmed)
* `isActive` (Boolean, default: `true`)

### 4. Task
[Task.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Task.js)
* `title` (String, required, trimmed)
* `description` (String, default: `""`, trimmed)
* `category` (String, default: `"General"`, trimmed)
* `department` (ObjectId, ref: `"Department"`, default: `null`)
* `assignedBy` (ObjectId, ref: `"User"`, required)
* `assignedTo` (ObjectId, ref: `"User"`, required)
* `priority` (String, enum: `["low", "medium", "high"]`, default: `"medium"`)
* `estimatedHours` (Number, default: `0`)
* `dueDate` (Date, default: `null`)
* `status` (String, enum: **`["Not Started", "In Progress", "Pending", "In Review", "Completed"]`**, default: `"Not Started"`) — the locked 5-state workflow (Locked Logic §3); see [api.md](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/docs/ai/api.md) for the transition rules
* `progressPercentage` (Number, default: `0`)
* `comments` (Array of `{ text (String, required, trimmed), author (ObjectId ref "User", required), createdAt (Date, default now) }`)
* `isActive` (Boolean, default: `true`) — soft-delete
* `isDaily` (Boolean, default: `false`) — marks a Daily Task instance
* `isCarryForward` (Boolean, default: `false`) — set when an incomplete daily task is rolled forward to a new day
* `templateRef` (ObjectId, ref: `"TaskTemplate"`, default: `null`) — links a daily task instance back to the template it was generated from
* `dailyDate` (Date, default: `null`) — the calendar day this daily task instance belongs to
* `history` (Array of `{ fromStatus (String, required), toStatus (String, required), changedBy (ObjectId ref "User", required), comment (String, default ""), timestamp (Date, default now) }`) — full audit trail of every status transition (Locked Logic §26); also read to compute pending-backlog age

### 5. TaskTemplate
[TaskTemplate.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/TaskTemplate.js)
* `title` (String, required, trimmed)
* `description` (String, default: `""`, trimmed)
* `category` (String, default: `"Daily"`, trimmed)
* `priority` (String, enum: `["low", "medium", "high"]`, default: `"medium"`)
* `estimatedHours` (Number, default: `1`)
* `scope` (String, enum: `["global", "department"]`, default: `"global"`) — `"global"` applies to every employee; `"department"` applies only to `departments`
* `departments` (Array of ObjectId, ref: `"Department"`, default: `[]`) — only meaningful when `scope === "department"`
* `isActive` (Boolean, default: `true`) — soft-delete
* `createdBy` (ObjectId, ref: `"User"`, required)

This is the source super_admin manage under Organization → Task Templates; `Backend/controllers/taskController.js`'s `ensureDailyTasks` reads active templates each day to auto-provision that day's `Task` instances (`isDaily: true`, `templateRef` pointing back here) and to carry forward yesterday's incomplete ones.

### 6. WorkSession
[WorkSession.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/WorkSession.js)
* `task` (ObjectId, ref: `"Task"`, required)
* `employee` (ObjectId, ref: `"User"`, required)
* `startedAt` (Date, default: `Date.now`)
* `events` (Array of `{ type (String, enum: ["pause", "resume"], required), timestamp (Date, default now) }`) — ordered pause/resume log
* `stoppedAt` (Date, default: `null`) — `null` means the session is still active/running
* `totalSeconds` (Number, default: `0`) — accumulated elapsed seconds, computed and frozen server-side only (Core Rule #1 — client timestamps are never trusted)

Elapsed-time math (`calculateSessionTime`/`calculateSessionSeconds`, currently duplicated between `workSessionController.js` and `taskController.js`): no events → running since `startedAt`; last event is `pause` → elapsed is frozen at `totalSeconds`; last event is `resume` → elapsed is `totalSeconds` + time since that resume.

### 7. DailyWorkLog
[DailyWorkLog.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/DailyWorkLog.js)
* `employee` (ObjectId, ref: `"User"`, required)
* `date` (Date, default: `Date.now`)
* `todaysWork` (String, required, trimmed)
* `hoursWorked` (Number, required)
* `tasksCompleted` (String, default: `""`, trimmed)
* `problemsFaced` (String, default: `""`, trimmed)
* `nextPlan` (String, default: `""`, trimmed)
* `remarks` (String, default: `""`, trimmed)

---

## Relationships at a Glance

```text
Department ──< Team ──< User (manager self-ref) ──< Task (assignedBy / assignedTo)
                                  │                        │
                                  │                        ├──< WorkSession
                                  │                        └── comments[] (author → User)
                                  │
                                  └──< DailyWorkLog

TaskTemplate ──< Task (templateRef, for isDaily tasks)
```

* No compound/explicit indexes are defined beyond Mongoose's implicit unique index on `User.email`, despite `WorkSession` being queried heavily by `employee` + `stoppedAt: null` and by `task` — worth revisiting under Rule #9 (MongoDB-specific: index appropriately) if these collections grow.
