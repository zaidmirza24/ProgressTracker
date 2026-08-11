# Database Documentation

This document describes the database layer of the application.

---

## Configuration & Connection

* **Database Engine**: MongoDB
* **ODM (Object Document Mapper)**: Mongoose (v9.x)
* **Status**: Connected successfully in `Backend/index.js` using the environment configuration.

---

## Active Database Models

All models are placed in the [Backend/models/](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models) directory.

### 1. User
* **Model File**: [User.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/User.js)
* **Fields**:
  * `name` (String, required, trimmed)
  * `email` (String, required, unique, lowercase, trimmed)
  * `passwordHash` (String, required)
  * `role` (String, enum: `["super_admin", "manager", "employee"]`, default: `"employee"`)
  * `department` (ObjectId, ref: `"Department"`, default: `null`)
  * `team` (ObjectId, ref: `"Team"`, default: `null`)
  * `manager` (ObjectId, ref: `"User"`, default: `null`)
  * `isActive` (Boolean, default: `true`)

### 2. Department
* **Model File**: [Department.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Department.js)
* **Fields**:
  * `name` (String, required, trimmed)
  * `description` (String, default: `""`, trimmed)
  * `isActive` (Boolean, default: `true`)

### 3. Team
* **Model File**: [Team.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Team.js)
* **Fields**:
  * `name` (String, required, trimmed)
  * `department` (ObjectId, ref: `"Department"`, required)
  * `description` (String, default: `""`, trimmed)
  * `isActive` (Boolean, default: `true`)

### 4. Task
* **Model File**: [Task.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/Task.js)
* **Fields**:
  * `title` (String, required, trimmed)
  * `description` (String, default: `""`, trimmed)
  * `category` (String, default: `"General"`, trimmed)
  * `department` (ObjectId, ref: `"Department"`, default: `null`)
  * `assignedBy` (ObjectId, ref: `"User"`, required)
  * `assignedTo` (ObjectId, ref: `"User"`, required)
  * `priority` (String, enum: `["low", "medium", "high"]`, default: `"medium"`)
  * `estimatedHours` (Number, default: `0`)
  * `dueDate` (Date, default: `null`)
  * `status` (String, enum: `["Not Started", "Accepted", "In Progress", "Waiting for Review", "Completed", "Approved", "Rejected", "Reopened"]`, default: `"Not Started"`)
  * `progressPercentage` (Number, default: `0`)
  * `comments` (Array of sub-schema: `text`, `author` ref: `"User"`, `createdAt`)
  * `isActive` (Boolean, default: `true`)

### 5. DailyWorkLog
* **Model File**: [DailyWorkLog.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/DailyWorkLog.js)
* **Fields**:
  * `employee` (ObjectId, ref: `"User"`, required)
  * `date` (Date, default: `Date.now`)
  * `todaysWork` (String, required, trimmed)
  * `hoursWorked` (Number, required)
  * `tasksCompleted` (String, default: `""`, trimmed)
  * `problemsFaced` (String, default: `""`, trimmed)
  * `nextPlan` (String, default: `""`, trimmed)
  * `remarks` (String, default: `""`, trimmed)

### 6. WorkSession
* **Model File**: [WorkSession.js](file:///c:/Users/mirza/OneDrive/Desktop/Projects/ProgressTracker/Backend/models/WorkSession.js)
* **Fields**:
  * `task` (ObjectId, ref: `"Task"`, required)
  * `employee` (ObjectId, ref: `"User"`, required)
  * `startedAt` (Date, default: `Date.now`)
  * `events` (Array of sub-schema: `type` enum: `["pause", "resume"]`, `timestamp`)
  * `stoppedAt` (Date, default: `null`)
  * `totalSeconds` (Number, default: `0`)
