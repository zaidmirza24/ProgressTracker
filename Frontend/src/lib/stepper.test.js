import { describe, it, expect } from "vitest"
import { getStepperSteps, normalizeForStepper } from "./stepper"
import { STATUS_LABELS, PRIORITY_VARIANTS, STATUS_VARIANTS, formatStatus } from "./taskConstants"

const selfAssigned = { assignedBy: { _id: "u1" }, assignedTo: { _id: "u1" } }
const managerAssigned = { assignedBy: { _id: "mgr" }, assignedTo: { _id: "u1" } }

describe("getStepperSteps", () => {
  it("omits review for self-assigned work, which never goes through it", () => {
    expect(getStepperSteps(selfAssigned).map(s => s.key))
      .toEqual(["Not Started", "In Progress", "Completed"])
  })

  it("includes review for manager-assigned work", () => {
    expect(getStepperSteps(managerAssigned).map(s => s.key))
      .toEqual(["Not Started", "In Progress", "In Review", "Completed"])
  })

  it("gives every step a label to render", () => {
    for (const task of [selfAssigned, managerAssigned]) {
      for (const step of getStepperSteps(task)) {
        expect(step.label).toBeTruthy()
      }
    }
  })

  it("never shows Pending as its own step", () => {
    // Pending is a paused sub-state of In Progress, not a stage of the workflow —
    // showing it as a step would imply pausing is progress.
    for (const task of [selfAssigned, managerAssigned]) {
      expect(getStepperSteps(task).map(s => s.key)).not.toContain("Pending")
    }
  })
})

describe("normalizeForStepper", () => {
  it("shows a paused task at the In Progress step", () => {
    expect(normalizeForStepper("Pending")).toBe("In Progress")
  })

  it("leaves every other status alone", () => {
    for (const status of ["Not Started", "In Progress", "In Review", "Completed"]) {
      expect(normalizeForStepper(status)).toBe(status)
    }
  })

  it("maps to a status the stepper actually contains", () => {
    // Guards the pairing: if normalize returned something absent from the step list,
    // the stepper would silently render with nothing highlighted.
    for (const task of [selfAssigned, managerAssigned]) {
      const keys = getStepperSteps(task).map(s => s.key)
      expect(keys).toContain(normalizeForStepper("Pending"))
    }
  })
})

describe("status display", () => {
  it("shows Pending as Paused, which is what the state actually means", () => {
    // The timer controller sets this state on every pause/stop/switch. Calling it
    // "Pending" alongside a real Blocked state was actively confusing.
    expect(STATUS_LABELS["Pending"]).toBe("Paused")
    expect(formatStatus("Pending")).toBe("Paused")
  })

  it("passes through an unrecognised status rather than blanking it", () => {
    // Legacy statuses still appear in older tasks' history timelines.
    expect(formatStatus("Approved")).toBe("Approved")
  })

  it("gives every status and priority a badge variant", () => {
    for (const status of Object.keys(STATUS_LABELS)) {
      expect(STATUS_VARIANTS[status]).toBeTruthy()
    }
    for (const priority of ["low", "medium", "high"]) {
      expect(PRIORITY_VARIANTS[priority]).toBeTruthy()
    }
  })
})
