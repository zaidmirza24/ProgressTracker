import { describe, it, expect, beforeEach } from "vitest"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask, makeDailyTask } from "../factories/index.js"

// The locked 5-state workflow driven end to end through the API:
//   Not Started → In Progress → Pending → In Review → Completed
//
// The unit matrix in tests/unit/config/workflow.test.js proves isValidTransition agrees
// with the product rules. This file proves the ENDPOINT enforces it, writes the right
// audit trail, and fires the right side effects.

const setStatus = (actor, task, status, body = {}) =>
  asUser(actor).put(`/api/tasks/${task._id}/status`).send({ status, ...body })

const reload = (task) => Task.findById(task._id)

describe("self-assigned work completes without review", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 }) // assignedBy defaults to self
  })

  it("walks Not Started → In Progress → Completed", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    const res = await setStatus(org.employeeA1, task, "Completed").expect(200)

    expect(res.body.task.status).toBe("Completed")
    expect(res.body.task.progressPercentage).toBe(100)
  })

  it("takes the same path for a daily task", async () => {
    // Daily tasks are self-assigned by construction, so they must never require review.
    const daily = await makeDailyTask({ assignedTo: org.employeeA1 })
    await setStatus(org.employeeA1, daily, "In Progress").expect(200)
    await setStatus(org.employeeA1, daily, "Completed").expect(200)
  })

  it("records who changed what, when, and why", async () => {
    await setStatus(org.employeeA1, task, "In Progress", { comment: "Starting now" }).expect(200)

    const saved = await reload(task)
    const entry = saved.history.at(-1)
    expect(entry).toMatchObject({ fromStatus: "Not Started", toStatus: "In Progress", comment: "Starting now" })
    expect(entry.changedBy.toString()).toBe(org.employeeA1._id.toString())
    expect(entry.timestamp).toBeInstanceOf(Date)
  })

  it("defaults the audit comment rather than leaving it blank", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    expect((await reload(task)).history.at(-1).comment).toBe("Status changed.")
  })
})

describe("manager-assigned work routes through review", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
  })

  it("stops the employee completing it directly", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    const res = await setStatus(org.employeeA1, task, "Completed").expect(400)
    expect(res.body.error).toMatch(/forbidden status transition/i)
    expect((await reload(task)).status).toBe("In Progress")
  })

  it("lets the employee submit for review, and the manager approve", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    await setStatus(org.employeeA1, task, "In Review").expect(200)
    const res = await setStatus(org.managerA, task, "Completed").expect(200)

    expect(res.body.task.status).toBe("Completed")
  })

  it("stops the employee acting on work that is under review", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    await setStatus(org.employeeA1, task, "In Review").expect(200)

    await setStatus(org.employeeA1, task, "In Progress").expect(400)
    await setStatus(org.employeeA1, task, "Completed").expect(400)
  })
})

describe("rework returns work to the employee's active workload", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    await setStatus(org.employeeA1, task, "In Review").expect(200)
  })

  it("sends it back to In Progress with the manager's feedback", async () => {
    const res = await setStatus(org.managerA, task, "In Progress", { comment: "Needs the summary section" }).expect(200)

    expect(res.body.task.status).toBe("In Progress")
    expect(res.body.task.reworkCount).toBe(1)
  })

  it("counts every round trip, so a twice-returned task is visibly different", async () => {
    await setStatus(org.managerA, task, "In Progress", { comment: "First pass" }).expect(200)
    await setStatus(org.employeeA1, task, "In Review").expect(200)
    const res = await setStatus(org.managerA, task, "In Progress", { comment: "Second pass" }).expect(200)

    expect(res.body.task.reworkCount).toBe(2)
  })

  it("surfaces rework in the manager's report, traceable to the task", async () => {
    await setStatus(org.managerA, task, "In Progress", { comment: "Needs work" }).expect(200)

    const res = await asUser(org.managerA).get("/api/tasks/report").expect(200)
    const row = res.body.employeeReport.find(r => r._id === org.employeeA1._id.toString())

    expect(row.reworkedTasks).toHaveLength(1)
    expect(row.reworkedTasks[0]).toMatchObject({ reworkCount: 1, lastFeedback: "Needs work" })
  })
})

describe("completed work is locked", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 })
    await setStatus(org.employeeA1, task, "In Progress").expect(200)
    await setStatus(org.employeeA1, task, "Completed").expect(200)
  })

  it("refuses field edits", async () => {
    const res = await asUser(org.managerA).patch(`/api/tasks/${task._id}`).send({ title: "Renamed" })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_LOCKED")
  })

  it("refuses cancellation, because completed work belongs in the metrics", async () => {
    const res = await asUser(org.managerA).delete(`/api/tasks/${task._id}`).send({ reason: "changed my mind" })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_LOCKED")
  })

  it("refuses to mark it blocked", async () => {
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "too late" })
    expect(res.status).toBe(409)
  })

  it("still accepts comments, which stay allowed after completion", async () => {
    // Locked Logic §4 — the record is final, but the conversation is not.
    const res = await asUser(org.managerA).post(`/api/tasks/${task._id}/comments`).send({ text: "Nicely done" })
    expect(res.status).toBe(200)
    expect(res.body.task.comments).toHaveLength(1)
  })

  it("gives the employee no way to reopen it", async () => {
    await setStatus(org.employeeA1, task, "In Progress").expect(400)
  })

  it("lets a manager reopen it for correction", async () => {
    const res = await setStatus(org.managerA, task, "In Progress").expect(200)
    expect(res.body.task.status).toBe("In Progress")
  })
})

describe("reassignment", () => {
  it("stops the previous assignee's timer and pauses the task, retaining the time", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    await asUser(org.managerA).patch(`/api/tasks/${task._id}`)
      .send({ assignedTo: org.employeeA2._id.toString() }).expect(200)

    const saved = await reload(task)
    expect(saved.assignedTo.toString()).toBe(org.employeeA2._id.toString())
    expect(saved.status).toBe("Pending")

    // The time is the task's, not the person's — it survives the handover.
    expect(await WorkSession.countDocuments({ task: task._id, employee: org.employeeA1._id })).toBe(1)
    expect(await WorkSession.countDocuments({ employee: org.employeeA1._id, stoppedAt: null })).toBe(0)
  })

  it("writes an audit entry naming both people", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })

    await asUser(org.managerA).patch(`/api/tasks/${task._id}`)
      .send({ assignedTo: org.employeeA2._id.toString() }).expect(200)

    const saved = await reload(task)
    const change = saved.history.flatMap(h => h.changes ?? []).find(c => c.field === "assignedTo")
    expect(change).toMatchObject({ from: org.employeeA1.name, to: org.employeeA2.name })
  })
})

describe("cancellation is a soft delete", () => {
  it("removes the task from every list but keeps its sessions and history", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    await asUser(org.managerA).delete(`/api/tasks/${task._id}`).send({ reason: "No longer needed" }).expect(200)

    const list = await asUser(org.managerA).get("/api/tasks").expect(200)
    expect(list.body.tasks.map(t => t._id)).not.toContain(task._id.toString())

    // Core Rule 2 — never hard-delete.
    const saved = await reload(task)
    expect(saved).not.toBeNull()
    expect(saved.isActive).toBe(false)
    expect(saved.history.at(-1).comment).toBe("No longer needed")
    expect(await WorkSession.countDocuments({ task: task._id })).toBe(1)
  })

  it("closes any running timer so it cannot dangle against cancelled work", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    await asUser(org.managerA).delete(`/api/tasks/${task._id}`).send({ reason: "Cancelled" }).expect(200)

    expect(await WorkSession.countDocuments({ employee: org.employeeA1._id, stoppedAt: null })).toBe(0)
  })

  it("requires a reason", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })

    const res = await asUser(org.managerA).delete(`/api/tasks/${task._id}`).send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("REASON_REQUIRED")
  })

  it("lets an employee cancel only their own not-yet-started work", async () => {
    const org = await buildOrg()
    const own = await makeTask({ assignedTo: org.employeeA1 })

    await asUser(org.employeeA1).delete(`/api/tasks/${own._id}`).send({ reason: "Mistake" }).expect(200)
  })

  it("stops an employee cancelling work already in flight", async () => {
    const org = await buildOrg()
    const own = await makeTask({ assignedTo: org.employeeA1 })
    await setStatus(org.employeeA1, own, "In Progress").expect(200)

    const res = await asUser(org.employeeA1).delete(`/api/tasks/${own._id}`).send({ reason: "Changed my mind" })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe("TASK_IN_PROGRESS")
  })
})

describe("blocked is orthogonal to status", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
  })

  it("lets the assignee declare their own task blocked, with a reason", async () => {
    // The person doing the work always knows first, even though they cannot edit the
    // task's other fields.
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "Waiting on the API key" }).expect(200)

    expect(res.body.task.isBlocked).toBe(true)
    expect(res.body.task.blockedReason).toBe("Waiting on the API key")
    // Status is untouched — blocked answers "can it proceed?", not "where is it?".
    expect(res.body.task.status).toBe("Not Started")
  })

  it("requires a reason to block, but not to unblock", async () => {
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`).send({ isBlocked: true })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("REASON_REQUIRED")

    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "stuck" }).expect(200)
    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`).send({ isBlocked: false }).expect(200)
  })

  it("rejects a double block or a redundant unblock", async () => {
    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "stuck" }).expect(200)

    const again = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "still stuck" })
    expect(again.body.code).toBe("ALREADY_BLOCKED")

    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`).send({ isBlocked: false }).expect(200)
    const notBlocked = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`).send({ isBlocked: false })
    expect(notBlocked.body.code).toBe("NOT_BLOCKED")
  })

  it("requires a boolean", async () => {
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`).send({ isBlocked: "yes" })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_INPUT")
  })
})

describe("optimistic concurrency", () => {
  it("rejects a status change based on a stale copy of the task", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })

    const stale = (await asUser(org.employeeA1).get("/api/tasks").expect(200)).body.tasks[0]

    // Someone else moves it first.
    await setStatus(org.managerA, task, "In Progress").expect(200)

    const res = await asUser(org.employeeA1).put(`/api/tasks/${task._id}/status`)
      .send({ status: "In Review", updatedAt: stale.updatedAt })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_MODIFIED")
  })

  it("rejects a field edit based on a stale copy", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    const stale = (await asUser(org.managerA).get("/api/tasks").expect(200)).body.tasks[0]

    await asUser(org.managerA).patch(`/api/tasks/${task._id}`).send({ title: "First edit" }).expect(200)

    const res = await asUser(org.managerA).patch(`/api/tasks/${task._id}`)
      .send({ title: "Second edit", updatedAt: stale.updatedAt })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_MODIFIED")
    expect((await reload(task)).title).toBe("First edit")
  })

  it("accepts a write that carries the current version", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    const current = (await asUser(org.managerA).get("/api/tasks").expect(200)).body.tasks[0]

    await asUser(org.managerA).patch(`/api/tasks/${task._id}`)
      .send({ title: "Renamed", updatedAt: current.updatedAt }).expect(200)
  })

  // Backend/utils/transaction.js: leaving "In Progress" now stops the running session
  // and saves the task inside one transaction, specifically so a rejected write can't
  // leave one half applied. A version conflict is the one failure mode this test can
  // trigger on demand — it exercises the same abort path a mid-write crash would.
  it("rolls back the session stop too when the status write is rejected as stale", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1 }) // self-assigned, skips review

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    const stale = (await asUser(org.employeeA1).get("/api/tasks").expect(200))
      .body.tasks.find(t => t._id === task._id.toString())
    expect(stale.status).toBe("In Progress")

    // Bump updatedAt without touching status, so the transition below is the one that
    // takes the "leaving In Progress" transactional branch and finds a stale version.
    await asUser(org.employeeA1).post(`/api/tasks/${task._id}/comments`).send({ text: "note" }).expect(200)

    const res = await setStatus(org.employeeA1, task, "Completed", { updatedAt: stale.updatedAt })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_MODIFIED")

    // If the transaction had only rolled back the task half, this session would show
    // stopped — the whole point of wrapping the two writes together.
    const session = await WorkSession.findOne({ task: task._id })
    expect(session.stoppedAt).toBeNull()
    expect((await reload(task)).status).toBe("In Progress")
  })
})

describe("capacity warnings flag but never block", () => {
  it("returns a warning and records it, while still creating the task", async () => {
    // Locked Logic §6 — advisory only, so a manager can decide rather than be stopped.
    const org = await buildOrg()
    const today = new Date()

    const res = await asUser(org.managerA).post("/api/tasks").send({
      title: "Enormous task",
      assignedTo: org.employeeA1._id.toString(),
      estimatedHours: 40,
      dueDate: today.toISOString()
    }).expect(201)

    expect(res.body.warning).toMatch(/capacity/i)

    const saved = await Task.findById(res.body.task._id)
    expect(saved).not.toBeNull()
    expect(saved.history[0].comment).toMatch(/over capacity/i)
  })

  it("says nothing when the assignment fits", async () => {
    const org = await buildOrg()
    const res = await asUser(org.managerA).post("/api/tasks").send({
      title: "Small task",
      assignedTo: org.employeeA1._id.toString(),
      estimatedHours: 1,
      dueDate: new Date().toISOString()
    }).expect(201)

    expect(res.body.warning).toBeUndefined()
  })
})

describe("input validation on create", () => {
  let org

  beforeEach(async () => { org = await buildOrg() })

  it("requires a title", async () => {
    await asUser(org.employeeA1).post("/api/tasks").send({}).expect(400)
  })

  it.each([
    ["negative", -1],
    ["above the 100 hour ceiling", 101],
    ["not a number", "abc"],
    ["an object", { $gt: 0 }]
  ])("rejects an estimate that is %s", async (_label, estimatedHours) => {
    // These feed every capacity, utilisation and overrun figure in the app, so an
    // unvalidated value here silently corrupts numbers a manager acts on.
    const res = await asUser(org.employeeA1).post("/api/tasks").send({ title: "T", estimatedHours })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_ESTIMATE")
  })

  it("treats a non-finite estimate as absent, because JSON cannot carry one", async () => {
    // `JSON.stringify(Infinity)` is the literal `null`, so the value never arrives as a
    // number at all and is correctly read as "no estimate given". The controller's
    // Number.isFinite guard still matters for any non-JSON caller.
    const res = await asUser(org.employeeA1).post("/api/tasks")
      .send({ title: "T", estimatedHours: Infinity }).expect(201)
    expect(res.body.task.estimatedHours).toBe(0)
  })

  it("rejects an unknown priority", async () => {
    const res = await asUser(org.employeeA1).post("/api/tasks").send({ title: "T", priority: "urgent" })
    expect(res.body.code).toBe("INVALID_PRIORITY")
  })

  it("rejects an unparseable due date", async () => {
    const res = await asUser(org.employeeA1).post("/api/tasks").send({ title: "T", dueDate: "not-a-date" })
    expect(res.body.code).toBe("INVALID_DUE_DATE")
  })

  it("treats an empty estimate as zero rather than rejecting it", async () => {
    const res = await asUser(org.employeeA1).post("/api/tasks").send({ title: "T", estimatedHours: "" }).expect(201)
    expect(res.body.task.estimatedHours).toBe(0)
  })
})
