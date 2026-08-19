import { getLocalDateString } from "./taskFormatters"

// Task form state shared by the create/edit modal and the shells that open it.
// Kept out of the component file so that file only exports a component (fast refresh).

// A function rather than a constant: `dueDate` defaults to *today*, and a module-level
// object would freeze that at app-load — a session left open past midnight would then
// pre-fill yesterday's date.
export const emptyTaskForm = () => ({
  title: "",
  description: "",
  category: "General",
  department: "",
  assignedTo: "",
  priority: "medium",
  estimatedHours: 0,
  dueDate: getLocalDateString()
})

// Builds form state from an existing task — handles both populated refs and raw ids.
export const taskToForm = (task) => ({
  title: task.title || "",
  description: task.description || "",
  category: task.category || "General",
  department: task.department?._id || task.department || "",
  assignedTo: task.assignedTo?._id || task.assignedTo || "",
  priority: task.priority || "medium",
  estimatedHours: task.estimatedHours || 0,
  dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
})
