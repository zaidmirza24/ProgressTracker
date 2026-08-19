import { describe, it, expect, beforeEach } from "vitest"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask } from "../factories/index.js"

// The timer, end to end through the real endpoints.
//
// Core Rule 1: timer events are always registered, processed and computed server-side —
// client timestamps are never trusted. Locked Logic §2: exactly one active timer per
// employee, and individual sessions are retained per task, never discarded.
//
// The invariant asserted after almost every action is that an employee has at most ONE
// session with `stoppedAt: null`. It is enforced by a partial unique index rather than
// application logic alone, and everything about tracked time depends on it holding.

const activeSessionsFor = (employee) =>
  WorkSession.countDocuments({ employee: employee._id, stoppedAt: null })

const statusOf = async (task) => (await Task.findById(task._id)).status

describe("starting a timer", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 })
  })

  it("creates a running session and moves the task to In Progress", async () => {
    const res = await asUser(org.employeeA1).post("/api/work-sessions/start")
      .send({ taskId: task._id }).expect(201)

    expect(res.body.isRunning).toBe(true)
    expect(res.body.session.stoppedAt).toBeNull()
    expect(await statusOf(task)).toBe("In Progress")
    expect(await activeSessionsFor(org.employeeA1)).toBe(1)
  })

  it("records the transition in the task's history", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    const saved = await Task.findById(task._id)
    expect(saved.history.at(-1)).toMatchObject({
      fromStatus: "Not Started",
      toStatus: "In Progress",
      comment: "Timer started"
    })
  })

  it("requires a taskId", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({}).expect(400)
  })

  it("404s for a task that does not exist or has been cancelled", async () => {
    await Task.updateOne({ _id: task._id }, { isActive: false })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(404)
  })

  it("switches tasks by stopping the previous timer and pausing that task", async () => {
    // Locked Logic §2 — starting a new task's timer auto-stops the current one.
    const second = await makeTask({ assignedTo: org.employeeA1, title: "Second" })

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: second._id }).expect(201)

    expect(await activeSessionsFor(org.employeeA1)).toBe(1)
    expect(await statusOf(task)).toBe("Pending")     // the one we left
    expect(await statusOf(second)).toBe("In Progress")

    // The first task's time is retained, never discarded.
    expect(await WorkSession.countDocuments({ task: task._id })).toBe(1)
    const previous = await WorkSession.findOne({ task: task._id })
    expect(previous.stoppedAt).not.toBeNull()
  })

  it("keeps one session per task, so time is attributed to the right work", async () => {
    const second = await makeTask({ assignedTo: org.employeeA1 })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: second._id }).expect(201)
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    expect(await WorkSession.countDocuments({ task: task._id })).toBe(2)
    expect(await WorkSession.countDocuments({ task: second._id })).toBe(1)
    expect(await activeSessionsFor(org.employeeA1)).toBe(1)
  })
})

describe("pause, resume and stop", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
  })

  it("pausing stops the clock and moves the task to Pending", async () => {
    const res = await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)

    expect(res.body.isRunning).toBe(false)
    expect(await statusOf(task)).toBe("Pending")
    // The session stays OPEN — pausing is not stopping. The time is still this session's.
    expect(await activeSessionsFor(org.employeeA1)).toBe(1)
  })

  it("resuming restarts the clock and moves the task back to In Progress", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)
    const res = await asUser(org.employeeA1).post("/api/work-sessions/resume").expect(200)

    expect(res.body.isRunning).toBe(true)
    expect(await statusOf(task)).toBe("In Progress")
  })

  it("pausing twice is idempotent rather than an error", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)
    const res = await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)
    expect(res.body.isRunning).toBe(false)

    const session = await WorkSession.findOne({ employee: org.employeeA1._id, stoppedAt: null })
    expect(session.events.filter(e => e.type === "pause")).toHaveLength(1)
  })

  it("resuming a running timer is idempotent", async () => {
    const res = await asUser(org.employeeA1).post("/api/work-sessions/resume").expect(200)
    expect(res.body.isRunning).toBe(true)

    const session = await WorkSession.findOne({ employee: org.employeeA1._id, stoppedAt: null })
    expect(session.events).toHaveLength(0)
  })

  it("stopping closes the session and moves the task to Pending", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/stop").expect(200)

    expect(await activeSessionsFor(org.employeeA1)).toBe(0)
    expect(await statusOf(task)).toBe("Pending")

    // Retained, not deleted (Locked Logic §2).
    const session = await WorkSession.findOne({ task: task._id })
    expect(session.stoppedAt).not.toBeNull()
  })

  it("404s when there is no active session to pause, resume or stop", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/stop").expect(200)

    await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(404)
    await asUser(org.employeeA1).post("/api/work-sessions/resume").expect(404)
    await asUser(org.employeeA1).post("/api/work-sessions/stop").expect(404)
  })

  it("does not let one employee's timer action touch another's session", async () => {
    // Every timer endpoint operates on `req.user.id`'s own session — there is no id in
    // the request to tamper with, which is the right design. This pins it.
    const otherTask = await makeTask({ assignedTo: org.employeeA2 })
    await asUser(org.employeeA2).post("/api/work-sessions/start").send({ taskId: otherTask._id }).expect(201)

    await asUser(org.employeeA1).post("/api/work-sessions/stop").expect(200)

    expect(await activeSessionsFor(org.employeeA2)).toBe(1)
    expect(await statusOf(otherTask)).toBe("In Progress")
  })
})

describe("GET /api/work-sessions/active — surviving a page refresh", () => {
  it("returns the running session and its elapsed time", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, title: "Rehydrate me" })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    const res = await asUser(org.employeeA1).get("/api/work-sessions/active").expect(200)

    expect(res.body.isRunning).toBe(true)
    expect(res.body.session.task.title).toBe("Rehydrate me")
    expect(res.body.elapsedSeconds).toBeGreaterThanOrEqual(0)
  })

  it("reports no session once stopped", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1 })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    await asUser(org.employeeA1).post("/api/work-sessions/stop").expect(200)

    const res = await asUser(org.employeeA1).get("/api/work-sessions/active").expect(200)
    expect(res.body.session).toBeNull()
    expect(res.body.isRunning).toBe(false)
  })

  it("does not leak another employee's session", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA2 })
    await asUser(org.employeeA2).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    const res = await asUser(org.employeeA1).get("/api/work-sessions/active").expect(200)
    expect(res.body.session).toBeNull()
  })
})

describe("auto-unblock when work resumes", () => {
  // Regression: the unblock logic originally lived only in setTaskStatus, which the
  // pause/resume/stop paths use. startSession sets the task directly, so START silently
  // did not unblock — a task could be actively worked on while still showing a "Blocked"
  // badge. Both paths are asserted here so the fix cannot regress on either.
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await makeTask({ assignedTo: org.employeeA1 })
    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "Waiting on design" }).expect(200)
  })

  it("clears the block when the timer is STARTED", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)

    const saved = await Task.findById(task._id)
    expect(saved.isBlocked).toBe(false)
    expect(saved.blockedReason).toBe("")
    expect(saved.blockedAt).toBeNull()
    expect(saved.history.some(h => h.comment === "Unblocked automatically — work resumed")).toBe(true)
  })

  it("clears the block when the timer is RESUMED", async () => {
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)

    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "Blocked again" }).expect(200)

    await asUser(org.employeeA1).post("/api/work-sessions/resume").expect(200)

    expect((await Task.findById(task._id)).isBlocked).toBe(false)
  })

  it("does not unblock merely because the timer was paused or stopped", async () => {
    // Pausing is not evidence the blocker is resolved.
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    await asUser(org.employeeA1).patch(`/api/tasks/${task._id}/blocked`)
      .send({ isBlocked: true, reason: "Blocked mid-work" }).expect(200)

    await asUser(org.employeeA1).post("/api/work-sessions/pause").expect(200)
    expect((await Task.findById(task._id)).isBlocked).toBe(true)
  })
})

describe("GET /api/work-sessions/today-hours", () => {
  it("starts at zero and reflects tracked time", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1 })

    const before = await asUser(org.employeeA1).get("/api/work-sessions/today-hours").expect(200)
    expect(before.body.hoursWorked).toBe(0)

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    const during = await asUser(org.employeeA1).get("/api/work-sessions/today-hours").expect(200)
    expect(during.body.hoursWorked).toBeGreaterThanOrEqual(0)
  })

  it("counts only the caller's own sessions", async () => {
    const org = await buildOrg()
    const otherTask = await makeTask({ assignedTo: org.employeeA2 })
    await asUser(org.employeeA2).post("/api/work-sessions/start").send({ taskId: otherTask._id }).expect(201)

    const res = await asUser(org.employeeA1).get("/api/work-sessions/today-hours").expect(200)
    expect(res.body.hoursWorked).toBe(0)
  })
})

describe("work that cannot legitimately be in progress", () => {
  // FIXED in Phase 6. The session used to be created BEFORE the workflow rules were
  // consulted: the status transition was correctly refused so the task stayed Completed,
  // but time kept accruing against a record Locked Logic §4 calls final — quietly moving
  // its estimated-vs-actual variance and overrun badge.
  it("refuses to start a timer on completed work", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, status: "Completed" })

    const res = await asUser(org.employeeA1).post("/api/work-sessions/start")
      .send({ taskId: task._id })

    expect(res.status).toBe(409)
    expect(res.body.code).toBe("TASK_NOT_STARTABLE")
    expect(await WorkSession.countDocuments({ task: task._id })).toBe(0)
    expect(await statusOf(task)).toBe("Completed")
  })

  it("refuses to start a timer on work sitting in review", async () => {
    // It is out of the employee's hands until the manager decides.
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA, status: "In Review" })

    const res = await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id })

    expect(res.status).toBe(409)
    expect(await WorkSession.countDocuments({ task: task._id })).toBe(0)
  })

  it("still allows a paused task to be resumed", async () => {
    // The guard must not block the ordinary case it sits next to.
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, status: "Pending" })

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    expect(await statusOf(task)).toBe("In Progress")
  })

  it("still allows restarting a task that is already In Progress", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, status: "In Progress" })

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }).expect(201)
    expect(await statusOf(task)).toBe("In Progress")
  })
})
