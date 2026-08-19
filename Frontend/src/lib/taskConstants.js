// DISPLAY labels for the workflow states. The stored enum values are unchanged (and
// must stay — config/workflow.js, isValidTransition and every query use them); this is
// purely what the user reads.
//
// "Pending" is renamed to "Paused" because that is what the code actually does: the
// timer controller sets this state on every pause/stop/switch. The locked doc's
// "pending backlog" concept — work that is genuinely waiting on something — is now
// carried by the separate `isBlocked` flag, so calling this state "Pending" alongside
// a real "Blocked" state was actively confusing.
export const STATUS_LABELS = {
  "Not Started": "Not Started",
  "In Progress": "In Progress",
  "Pending": "Paused",
  "In Review": "In Review",
  "Completed": "Completed"
}

// Falls through unknown values (e.g. legacy statuses still present in task history).
export const formatStatus = (status) => STATUS_LABELS[status] || status

export const STATUS_VARIANTS = {
  "Not Started": "secondary",
  "In Progress": "violet",
  "Pending": "warning",
  "In Review": "info",
  "Completed": "success"
}

export const PRIORITY_VARIANTS = {
  low: "outline",
  medium: "secondary",
  high: "destructive"
}

// Mirrors Backend/controllers/taskController.js getProgressForStatus — used for optimistic UI only,
// the server value returned after the request always wins.
export const PROGRESS_FOR_STATUS = {
  "Not Started": 0,
  "In Progress": 50,
  "Pending": 50,
  "In Review": 90,
  "Completed": 100
}

export const CATEGORY_PRESETS = [
  "Development",
  "Design",
  "QA / Testing",
  "Bug Fix",
  "Documentation",
  "DevOps / Infra",
  "Research",
  "In-Office Work",
  "Client Meeting",
  "Admin / HR"
]
