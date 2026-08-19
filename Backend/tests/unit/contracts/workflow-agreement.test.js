import { describe, it, expect } from "vitest"
import { isValidTransition, TASK_STATUSES } from "../../../config/workflow.js"
import { getProgressForStatus } from "../../../services/taskMetrics.js"
import { getNextStatuses, getNextStatusesForManager } from "@frontend/lib/taskHelpers.js"
import { PROGRESS_FOR_STATUS, STATUS_LABELS } from "@frontend/lib/taskConstants.js"

// MIRROR CONTRACT: the workflow rules and the progress mapping each exist twice.
//
//   Backend  config/workflow.js        isValidTransition — the enforced rule
//   Frontend lib/taskHelpers.js        getNextStatuses / getNextStatusesForManager
//                                      — what the UI offers in its dropdowns
//
//   Backend  services/taskMetrics.js   getProgressForStatus — the stored value
//   Frontend lib/taskConstants.js      PROGRESS_FOR_STATUS  — the optimistic value
//
// The failure these prevent is a quiet one. If the frontend offers a transition the
// backend rejects, the user picks it, watches the UI update optimistically, and then
// sees it snap back with an error they cannot act on. If it omits a transition the
// backend allows, a capability simply disappears with nothing to indicate why. Neither
// shows up in a test of either side alone.

// The frontend reads assignment from populated refs on the task object.
const taskFor = (status, isSelfAssigned) => ({
  status,
  assignedBy: { _id: "user-1" },
  assignedTo: { _id: isSelfAssigned ? "user-1" : "user-2" }
})

// What the backend would actually permit, excluding the no-op transition (which the UI
// has no reason to offer as a choice).
const backendAllows = (role, isSelfAssigned, from) =>
  TASK_STATUSES.filter(to => to !== from && isValidTransition(role, isSelfAssigned, from, to))

const asSet = (values) => [...values].sort()

describe("workflow agreement — employee dropdowns match enforced rules", () => {
  for (const isSelfAssigned of [true, false]) {
    const label = isSelfAssigned ? "self-assigned" : "manager-assigned"

    for (const from of TASK_STATUSES) {
      it(`offers exactly the permitted transitions from ${from} (${label})`, () => {
        const offered = getNextStatuses(taskFor(from, isSelfAssigned))
        expect(asSet(offered)).toEqual(asSet(backendAllows("employee", isSelfAssigned, from)))
      })
    }
  }
})

describe("workflow agreement — manager dropdowns match enforced rules", () => {
  for (const from of TASK_STATUSES) {
    it(`offers exactly the permitted transitions from ${from}`, () => {
      const offered = getNextStatusesForManager(taskFor(from, false))
      expect(asSet(offered)).toEqual(asSet(backendAllows("manager", false, from)))
    })
  }

  it("matches what a super_admin is permitted too, since they share one UI", () => {
    // ManagerTaskDetailModal is rendered for both roles (Iteration 12's shared
    // TeamCommandCenter), so a divergence between the two rule sets would surface as a
    // dropdown that works for one role and errors for the other.
    for (const from of TASK_STATUSES) {
      expect(asSet(getNextStatusesForManager(taskFor(from, false))))
        .toEqual(asSet(backendAllows("super_admin", false, from)))
    }
  })
})

describe("progress mapping agreement", () => {
  for (const status of TASK_STATUSES) {
    it(`maps ${status} to the same percentage on both sides`, () => {
      // The client applies its value optimistically the moment the user clicks; the
      // server's value arrives with the response and wins. If they differ, the progress
      // bar visibly jumps for every transition of that type.
      expect(PROGRESS_FOR_STATUS[status]).toBe(getProgressForStatus(status))
    })
  }

  it("covers every workflow status with no extras", () => {
    expect(asSet(Object.keys(PROGRESS_FOR_STATUS))).toEqual(asSet(TASK_STATUSES))
  })
})

describe("status label coverage", () => {
  it("gives every workflow status a display label", () => {
    // "Pending" is deliberately shown as "Paused" (taskConstants.js explains why), so
    // labels and stored values are asserted to COVER each other, never to be equal.
    expect(asSet(Object.keys(STATUS_LABELS))).toEqual(asSet(TASK_STATUSES))
    for (const status of TASK_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy()
    }
  })
})
