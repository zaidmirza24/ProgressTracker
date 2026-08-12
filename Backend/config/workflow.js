export const WORKFLOW_RULES = {
  employee: {
    self_assigned: {
      "Not Started": ["Accepted", "In Progress"],
      "Accepted": ["In Progress"],
      "In Progress": ["Completed"],
      "Completed": ["In Progress"]
    },
    manager_assigned: {
      "Not Started": ["Accepted", "In Progress"],
      "Accepted": ["In Progress"],
      "In Progress": ["Waiting for Review"],
      "Rejected": ["In Progress"],
      "Reopened": ["In Progress"]
    }
  },
  manager: {
    "Not Started": ["Accepted", "In Progress"],
    "Accepted": ["In Progress"],
    "In Progress": ["Waiting for Review"],
    "Waiting for Review": ["Approved", "Rejected"],
    "Approved": ["Reopened"],
    "Rejected": ["In Progress"],
    "Reopened": ["In Progress"]
  },
  super_admin: {
    "Not Started": ["Accepted", "In Progress"],
    "Accepted": ["In Progress"],
    "In Progress": ["Completed", "Waiting for Review"],
    "Waiting for Review": ["Approved", "Rejected"],
    "Approved": ["Reopened"],
    "Rejected": ["In Progress"],
    "Reopened": ["In Progress"],
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
