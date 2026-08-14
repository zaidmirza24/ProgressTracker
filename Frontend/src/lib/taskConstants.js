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
