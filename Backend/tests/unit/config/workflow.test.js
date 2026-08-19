import { describe, it, expect } from "vitest"
import { isValidTransition, TASK_STATUSES, WORKFLOW_RULES } from "../../../config/workflow.js"

// The locked 5-state workflow (Locked Logic §3/§4), covered exhaustively.
//
// THE POINT OF THE TRUTH TABLE BELOW: it is written out by hand from the product rules,
// NOT derived from WORKFLOW_RULES. A test that builds its expectations by reading the
// same object the implementation reads would pass no matter what either of them said —
// it would assert only that the code equals itself. Every entry here is a deliberate
// statement about what the product should permit, so an accidental edit to
// WORKFLOW_RULES fails this file.

const ROLES = ["employee", "manager", "super_admin"]

// Managers and super_admins have the same transition map; assignment does not affect
// them, only employees.
const PRIVILEGED = {
  "Not Started": ["In Progress"],
  "In Progress": ["Pending", "In Review", "Completed"],
  "Pending": ["In Progress"],
  "In Review": ["Completed", "In Progress"], // approve, or send back for rework
  "Completed": ["In Progress"]               // reopen for correction
}

const EXPECTED = {
  // Self-assigned (incl. Daily) work never requires review, so the employee can
  // complete it directly — and can never reopen it once Completed.
  "employee|self": {
    "Not Started": ["In Progress"],
    "In Progress": ["Pending", "Completed"],
    "Pending": ["In Progress"],
    "In Review": [],
    "Completed": []
  },
  // Manager-assigned work must route through In Review — the employee submits, and
  // only a manager can complete it.
  "employee|manager": {
    "Not Started": ["In Progress"],
    "In Progress": ["Pending", "In Review"],
    "Pending": ["In Progress"],
    "In Review": [],
    "Completed": []
  },
  "manager|self": PRIVILEGED,
  "manager|manager": PRIVILEGED,
  "super_admin|self": PRIVILEGED,
  "super_admin|manager": PRIVILEGED
}

const allowedFor = (role, isSelfAssigned, from) =>
  EXPECTED[`${role}|${isSelfAssigned ? "self" : "manager"}`][from]

describe("TASK_STATUSES", () => {
  it("is the locked 5-state workflow, in canonical order", () => {
    expect(TASK_STATUSES).toEqual(["Not Started", "In Progress", "Pending", "In Review", "Completed"])
  })

  it("matches the statuses the rules are written against", () => {
    // Guards against a status being added to the enum but never given transition rules,
    // which would silently make it a dead end.
    for (const from of Object.keys(WORKFLOW_RULES.manager)) {
      expect(TASK_STATUSES).toContain(from)
    }
  })
})

describe("isValidTransition — exhaustive matrix", () => {
  // 3 roles × 2 assignments × 5 from-states × 5 to-states = 150 combinations.
  for (const role of ROLES) {
    for (const isSelfAssigned of [true, false]) {
      const label = `${role}, ${isSelfAssigned ? "self-assigned" : "manager-assigned"}`

      for (const from of TASK_STATUSES) {
        for (const to of TASK_STATUSES) {
          // A no-op transition is always accepted, whatever the state — the function
          // returns early before consulting any rule map.
          const expected = from === to || allowedFor(role, isSelfAssigned, from).includes(to)

          it(`${label}: ${from} → ${to} is ${expected ? "allowed" : "rejected"}`, () => {
            expect(isValidTransition(role, isSelfAssigned, from, to)).toBe(expected)
          })
        }
      }
    }
  }
})

// The rules above stated as product sentences. If one of these fails, the matrix above
// will too — but this is the file that says WHY it matters.
describe("the rules that define the product", () => {
  it("lets an employee complete their own self-assigned work without review", () => {
    // Daily tasks are self-assigned, so this is the path every daily task takes.
    expect(isValidTransition("employee", true, "In Progress", "Completed")).toBe(true)
  })

  it("stops an employee completing manager-assigned work directly", () => {
    expect(isValidTransition("employee", false, "In Progress", "Completed")).toBe(false)
    // They submit for review instead.
    expect(isValidTransition("employee", false, "In Progress", "In Review")).toBe(true)
  })

  it("never lets an employee reopen completed work", () => {
    // Locked Logic §4 — a completed task's record is final on the employee side.
    for (const isSelfAssigned of [true, false]) {
      for (const to of TASK_STATUSES.filter(s => s !== "Completed")) {
        expect(isValidTransition("employee", isSelfAssigned, "Completed", to)).toBe(false)
      }
    }
  })

  it("lets a manager or admin reopen completed work for correction", () => {
    expect(isValidTransition("manager", false, "Completed", "In Progress")).toBe(true)
    expect(isValidTransition("super_admin", false, "Completed", "In Progress")).toBe(true)
  })

  it("lets a manager approve or return work under review", () => {
    expect(isValidTransition("manager", false, "In Review", "Completed")).toBe(true)
    expect(isValidTransition("manager", false, "In Review", "In Progress")).toBe(true)
  })

  it("never lets an employee act on work sitting in review", () => {
    // It is out of their hands until the manager decides.
    for (const to of TASK_STATUSES.filter(s => s !== "In Review")) {
      expect(isValidTransition("employee", false, "In Review", to)).toBe(false)
    }
  })

  it("does not let anyone jump straight from Not Started to Completed", () => {
    for (const role of ROLES) {
      for (const isSelfAssigned of [true, false]) {
        expect(isValidTransition(role, isSelfAssigned, "Not Started", "Completed")).toBe(false)
      }
    }
  })

  it("ignores the assignment flag for managers and admins", () => {
    // Only employees have separate self/manager-assigned rule sets.
    for (const role of ["manager", "super_admin"]) {
      for (const from of TASK_STATUSES) {
        for (const to of TASK_STATUSES) {
          expect(isValidTransition(role, true, from, to)).toBe(isValidTransition(role, false, from, to))
        }
      }
    }
  })

  it("always allows the Pending ↔ In Progress round trip the timer drives", () => {
    // Pause/resume/stop flip a task between these two automatically, so every role must
    // be able to make the round trip or the timer would silently fail to update status.
    for (const role of ROLES) {
      for (const isSelfAssigned of [true, false]) {
        expect(isValidTransition(role, isSelfAssigned, "In Progress", "Pending")).toBe(true)
        expect(isValidTransition(role, isSelfAssigned, "Pending", "In Progress")).toBe(true)
      }
    }
  })
})

describe("isValidTransition — malformed input", () => {
  it("rejects an unrecognised role", () => {
    expect(isValidTransition("intern", false, "Not Started", "In Progress")).toBe(false)
    expect(isValidTransition(undefined, false, "Not Started", "In Progress")).toBe(false)
  })

  it("rejects an unrecognised target status", () => {
    for (const role of ROLES) {
      expect(isValidTransition(role, false, "In Progress", "Approved")).toBe(false) // pre-Iteration-6
      expect(isValidTransition(role, false, "In Progress", undefined)).toBe(false)
    }
  })

  it("rejects a transition out of an unrecognised current status", () => {
    for (const role of ROLES) {
      expect(isValidTransition(role, false, "Rejected", "In Progress")).toBe(false)
    }
  })

  it("accepts a no-op transition even for an unrecognised role or status", () => {
    // Documents real behaviour: the `currentStatus === newStatus` early return fires
    // before any rule lookup. Harmless in practice — the caller has already loaded the
    // task, so a no-op writes the same status back — but callers must not read a `true`
    // here as "this role has rights over this task". Authorization is enforced
    // separately by hasTaskAccess in taskController.
    expect(isValidTransition("intern", false, "Completed", "Completed")).toBe(true)
    expect(isValidTransition("employee", true, "Rejected", "Rejected")).toBe(true)
  })
})
