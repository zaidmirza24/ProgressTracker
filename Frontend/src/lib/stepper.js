import { isSelfCreated } from "./taskHelpers"

// Visual Stepper steps configuration (Pending is a transient sub-state of In Progress, not its own step)
export const getStepperSteps = (task) => {
  if (isSelfCreated(task)) {
    return [
      { label: "Not Started", key: "Not Started" },
      { label: "In Progress", key: "In Progress" },
      { label: "Completed", key: "Completed" }
    ]
  } else {
    return [
      { label: "Not Started", key: "Not Started" },
      { label: "In Progress", key: "In Progress" },
      { label: "In Review", key: "In Review" },
      { label: "Completed", key: "Completed" }
    ]
  }
}

// Pending is a paused sub-state of In Progress — treat it as such for stepper position
export const normalizeForStepper = (status) => (status === "Pending" ? "In Progress" : status)
