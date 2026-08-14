// Canonical workflow (locked product logic): Not Started → In Progress → Pending → In Review → Completed
// "In Review" only applies to tasks that require manager review (manager-assigned tasks).
// Self-assigned tasks (assignedBy === assignedTo, incl. Daily Tasks) never require review and can be
// completed directly by the employee. Completed tasks are locked — employees cannot reopen them.
export const WORKFLOW_RULES = {
  employee: {
    self_assigned: {
      "Not Started": ["In Progress"],
      "In Progress": ["Pending", "Completed"],
      "Pending": ["In Progress"]
    },
    manager_assigned: {
      "Not Started": ["In Progress"],
      "In Progress": ["Pending", "In Review"],
      "Pending": ["In Progress"]
    }
  },
  manager: {
    "Not Started": ["In Progress"],
    "In Progress": ["Pending", "In Review", "Completed"],
    "Pending": ["In Progress"],
    "In Review": ["Completed", "In Progress"], // Approve, or send back for rework
    "Completed": ["In Progress"] // Reopen for correction
  },
  super_admin: {
    "Not Started": ["In Progress"],
    "In Progress": ["Pending", "In Review", "Completed"],
    "Pending": ["In Progress"],
    "In Review": ["Completed", "In Progress"],
    "Completed": ["In Progress"]
  }
}

/**
 * Validates a task status transition based on user role and assignment.
 * @param {string} role - User role (employee, manager, super_admin)
 * @param {boolean} isSelfAssigned - Whether task assignment is local (assignedBy === assignedTo)
 * @param {string} currentStatus - Current task state
 * @param {string} newStatus - Requested task state
 * @returns {boolean} - True if transition is valid
 */
export const isValidTransition = (role, isSelfAssigned, currentStatus, newStatus) => {
  // If no state change, it is technically valid
  if (currentStatus === newStatus) return true

  // Super admins bypass standard role boundaries but must conform to super_admin flow maps
  if (role === "super_admin") {
    const allowed = WORKFLOW_RULES.super_admin[currentStatus] || []
    return allowed.includes(newStatus)
  }

  const roleRules = WORKFLOW_RULES[role]
  if (!roleRules) return false

  const rules = (role === "employee")
    ? (isSelfAssigned ? roleRules.self_assigned : roleRules.manager_assigned)
    : roleRules

  const allowed = rules[currentStatus] || []
  return allowed.includes(newStatus)
}
