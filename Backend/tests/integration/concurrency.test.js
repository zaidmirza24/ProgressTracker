import { describe, it, expect, beforeEach } from "vitest"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import DailyWorkLog from "../../models/DailyWorkLog.js"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask, makeTemplate, setOrgSettings } from "../factories/index.js"
import { provisionDailyTasksForEmployee } from "../../services/dailyTaskService.js"

// Correctness under concurrency, not throughput (Standards §29).
//
// Every case here is a real double-submit: a double-clicked button, two open tabs, a
// retried request. The question is never "how fast" but "does the invariant still hold
// when two writes interleave" — and for the timer, the invariant is enforced by a
// database constraint rather than by application logic, which is exactly why it must be
// exercised concurrently to mean anything.
//
// ── HOW KNOWN GAPS ARE RECORDED HERE ───────────────────────────────────────────
// Three gaps below are real but only manifest when two requests genuinely interleave,
// which does not happen on every run. `it.fails` was tried first and proved flaky — a
// race that happens to resolve benignly makes the test pass, and a passing `it.fails`
// is reported as a failure. Two spurious reds in roughly fifteen full-suite runs is
// enough to teach a team to re-run instead of read, which is worse than no test.
//
// Instead each gap is demonstrated with `demonstrateRace`, which retries a few times and
// asserts the broken outcome is REACHABLE. That is green and quiet today, and the moment
// the gap is fixed the outcome stops being reachable and the test fails — the same
// notification `it.fails` was there to give, without the noise.

const settle = (promises) => Promise.allSettled(promises).then(rs => rs.map(r => r.value ?? r.reason))
const statusesOf = (responses) => responses.map(r => r.status).sort()

/**
 * Run `attempt` until it reports the broken outcome, up to `tries` times.
 *
 * Returns true as soon as the gap is observed. Once a gap is FIXED the broken outcome
 * becomes unreachable, every try comes back false, and the caller's assertion fails —
 * which is the signal to rewrite the test as a proper invariant.
 */
const demonstrateRace = async (attempt, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    if (await attempt(i)) return true
  }
  return false
}

describe("two timers started at once", () => {
  let org

  beforeEach(async () => { org = await buildOrg() })

  it("converges on exactly one active session for the same task", async () => {
    const task = await makeTask({ assignedTo: org.employeeA1 })

    const responses = await settle([
      asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id }),
      asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: task._id })
    ])

    // Locked Logic §2, enforced by the partial unique index on {employee, stoppedAt:null}.
    expect(await WorkSession.countDocuments({ employee: org.employeeA1._id, stoppedAt: null })).toBe(1)
    // Neither caller sees a raw duplicate-key 500 — the loser retries and converges.
    for (const res of responses) expect(res.status).not.toBe(500)
  })

  it("converges on one active session across two different tasks", async () => {
    const first = await makeTask({ assignedTo: org.employeeA1, title: "First" })
    const second = await makeTask({ assignedTo: org.employeeA1, title: "Second" })

    const responses = await settle([
      asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: first._id }),
      asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: second._id })
    ])

    expect(await WorkSession.countDocuments({ employee: org.employeeA1._id, stoppedAt: null })).toBe(1)
    for (const res of responses) expect(res.status).not.toBe(500)
  })

  // FIXED in Phase 6, and now a real invariant rather than a documented gap.
  //
  // The bug: `previousTaskId` was read from the active session BEFORE the new one was
  // created, so under two simultaneous starts the second request could see "nothing
  // active" and never pause the first task — leaving two tasks In Progress with one
  // timer. startSessionForTask now returns the sessions it actually stopped, so the
  // caller pauses exactly those tasks whatever the interleaving.
  it("never leaves a task In Progress with no timer behind it", async () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const first = await makeTask({ assignedTo: org.employeeA1, title: `First ${attempt}` })
      const second = await makeTask({ assignedTo: org.employeeA1, title: `Second ${attempt}` })

      await settle([
        asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: first._id }),
        asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: second._id })
      ])

      const running = await WorkSession.findOne({ employee: org.employeeA1._id, stoppedAt: null })
      const inProgress = await Task.find({ assignedTo: org.employeeA1._id, status: "In Progress" })

      expect(inProgress.length).toBeLessThanOrEqual(1)
      if (inProgress.length === 1) {
        expect(running.task.toString()).toBe(inProgress[0]._id.toString())
      }

      await Task.deleteMany({ _id: { $in: [first._id, second._id] } })
      await WorkSession.deleteMany({ employee: org.employeeA1._id })
    }
  })

  it("holds the invariant under a burst of five simultaneous starts", async () => {
    const tasks = await Promise.all(
      [1, 2, 3, 4, 5].map(n => makeTask({ assignedTo: org.employeeA1, title: `Task ${n}` }))
    )

    const responses = await settle(
      tasks.map(t => asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: t._id }))
    )

    expect(await WorkSession.countDocuments({ employee: org.employeeA1._id, stoppedAt: null })).toBe(1)
    for (const res of responses) expect(res.status).not.toBe(500)
  })

  it("does not serialise different employees against each other", async () => {
    // The constraint is per-employee. Two people starting timers at the same instant
    // must both succeed.
    const a = await makeTask({ assignedTo: org.employeeA1 })
    const b = await makeTask({ assignedTo: org.employeeA2 })

    const responses = await settle([
      asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: a._id }),
      asUser(org.employeeA2).post("/api/work-sessions/start").send({ taskId: b._id })
    ])

    expect(statusesOf(responses)).toEqual([201, 201])
    expect(await WorkSession.countDocuments({ stoppedAt: null })).toBe(2)
  })
})

describe("two work logs submitted at once", () => {
  it("accepts exactly one and rejects the duplicate", async () => {
    // One log per person per day. The controller's pre-check is a friendly fast path;
    // the real guard is the partial unique index on {employee, logDate}, because both
    // requests can pass the pre-check before either commits.
    const org = await buildOrg()

    const responses = await settle([
      asUser(org.employeeA1).post("/api/daily-work-logs").send({ todaysWork: "First", hoursWorked: 7 }),
      asUser(org.employeeA1).post("/api/daily-work-logs").send({ todaysWork: "Second", hoursWorked: 7 })
    ])

    expect(statusesOf(responses)).toEqual([201, 409])
    expect(await DailyWorkLog.countDocuments({ employee: org.employeeA1._id })).toBe(1)

    const conflict = responses.find(r => r.status === 409)
    expect(conflict.body.code).toBe("LOG_ALREADY_SUBMITTED")
  })

  it("still lets a different employee submit their own", async () => {
    const org = await buildOrg()
    const responses = await settle([
      asUser(org.employeeA1).post("/api/daily-work-logs").send({ todaysWork: "Mine", hoursWorked: 7 }),
      asUser(org.employeeA2).post("/api/daily-work-logs").send({ todaysWork: "Theirs", hoursWorked: 7 })
    ])

    expect(statusesOf(responses)).toEqual([201, 201])
  })
})

describe("two edits of the same task at once", () => {
  // The org is built ONCE for the whole describe, not per retry: buildOrg uses fixed
  // email addresses (so report goldens stay stable) and the database is only cleared
  // between tests, so calling it twice inside one test collides on the unique index.
  let org

  beforeEach(async () => { org = await buildOrg() })

  // FIXED in Phase 6. The check used to be read-compare-write in JavaScript: load,
  // compare, mutate, save. That correctly rejects a stale write from a browser tab left
  // open — where the requests are sequential — but did nothing about two SIMULTANEOUS
  // writes, which both read the same version, both passed, and both saved, silently
  // losing one edit. The comparison now lives in the update filter, so MongoDB performs
  // the compare-and-swap atomically.
  it("lets exactly one simultaneous edit through and rejects the other as stale", async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
      const version = (await asUser(org.managerA).get(`/api/tasks?assignedTo=${org.employeeA1._id}`)
        .expect(200)).body.tasks.find(t => t._id === task._id.toString()).updatedAt

      const responses = await settle([
        asUser(org.managerA).patch(`/api/tasks/${task._id}`).send({ title: `A${attempt}`, updatedAt: version }),
        asUser(org.managerA).patch(`/api/tasks/${task._id}`).send({ title: `B${attempt}`, updatedAt: version })
      ])

      expect(statusesOf(responses)).toEqual([200, 409])
      expect(responses.find(r => r.status === 409).body.code).toBe("TASK_MODIFIED")

      // The surviving edit is whole — not a blend of the two.
      const saved = await Task.findById(task._id)
      expect([`A${attempt}`, `B${attempt}`]).toContain(saved.title)

      await Task.deleteOne({ _id: task._id })
    }
  })

  it("lets exactly one simultaneous status change through", async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
      const version = (await asUser(org.managerA).get(`/api/tasks?assignedTo=${org.employeeA1._id}`)
        .expect(200)).body.tasks.find(t => t._id === task._id.toString()).updatedAt

      const responses = await settle([
        asUser(org.managerA).put(`/api/tasks/${task._id}/status`).send({ status: "In Progress", updatedAt: version }),
        asUser(org.employeeA1).put(`/api/tasks/${task._id}/status`).send({ status: "In Progress", updatedAt: version })
      ])

      expect(responses.filter(r => r.status === 409)).toHaveLength(1)

      await Task.deleteOne({ _id: task._id })
      await WorkSession.deleteMany({})
    }
  })

  it("still applies a write that carries no version at all", async () => {
    // `updatedAt` is optional; callers that omit it keep the previous unconditional
    // behaviour rather than being rejected outright.
    const task = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
    await asUser(org.managerA).patch(`/api/tasks/${task._id}`).send({ title: "No version sent" }).expect(200)
    expect((await Task.findById(task._id)).title).toBe("No version sent")
  })
})

describe("daily provisioning run twice at once", () => {
  // Provisioning refuses to run on a non-working day, and these tests use the real
  // clock. Without an all-days calendar the suite would pass Monday to Friday and fail
  // every weekend — the sort of flake that gets a whole suite disabled.
  beforeEach(async () => {
    await setOrgSettings({ workingDays: [0, 1, 2, 3, 4, 5, 6] })
  })
  // FIXED in Phase 6. Provisioning does findOne-then-create, which application logic
  // alone cannot make safe — the midnight cron and an employee's login self-heal run the
  // same code by design, so the overlap is routine rather than hypothetical. A partial
  // unique index now makes the duplicate impossible, and the service treats the
  // resulting duplicate-key error as "someone else already did it".
  it("cannot create duplicate daily tasks, however the runs interleave", async () => {
    const org = await buildOrg()
    const template = await makeTemplate({ createdBy: org.superAdmin, title: "Morning Standup" })

    // Repeated because the interleaving varies from run to run; every one of them must
    // land on a single task.
    for (let attempt = 0; attempt < 4; attempt++) {
      await settle([
        provisionDailyTasksForEmployee(org.employeeA1._id),
        provisionDailyTasksForEmployee(org.employeeA1._id),
        provisionDailyTasksForEmployee(org.employeeA1._id)
      ])

      expect(await Task.countDocuments({
        assignedTo: org.employeeA1._id, templateRef: template._id, isActive: true
      })).toBe(1)
    }
  })

  it("is guarded by a database constraint, not just application logic", async () => {
    // The guard has to live in the database: two processes cannot coordinate a
    // check-then-act between themselves.
    const indexes = await Task.collection.indexes()

    const constraint = indexes.find(index => {
      if (!index.unique) return false
      const keys = Object.keys(index.key)
      return keys.includes("assignedTo") && keys.includes("templateRef") && keys.includes("dailyDate")
    })

    expect(constraint).toBeDefined()
    // Partial, so a cancelled instance never blocks its replacement and ad-hoc tasks
    // (which have no templateRef) are unaffected.
    expect(constraint.partialFilterExpression).toMatchObject({ isActive: true, isDaily: true })
  })

  it("still replaces a daily task that was cancelled earlier the same day", async () => {
    // The constraint must not strand an employee with no task for a template today.
    const org = await buildOrg()
    const template = await makeTemplate({ createdBy: org.superAdmin })

    await provisionDailyTasksForEmployee(org.employeeA1._id)
    const first = await Task.findOne({ assignedTo: org.employeeA1._id, templateRef: template._id })
    await Task.updateOne({ _id: first._id }, { isActive: false })

    await provisionDailyTasksForEmployee(org.employeeA1._id)

    const active = await Task.find({
      assignedTo: org.employeeA1._id, templateRef: template._id, isActive: true
    })
    expect(active).toHaveLength(1)
    expect(active[0]._id.toString()).not.toBe(first._id.toString())
  })

  it("is idempotent when run repeatedly", async () => {
    const org = await buildOrg()
    const template = await makeTemplate({ createdBy: org.superAdmin })

    for (let i = 0; i < 3; i++) {
      await provisionDailyTasksForEmployee(org.employeeA1._id)
    }

    expect(await Task.countDocuments({
      assignedTo: org.employeeA1._id, templateRef: template._id, isActive: true
    })).toBe(1)
  })
})

describe("double-clicked task creation", () => {
  it("creates two tasks, because nothing claims otherwise", async () => {
    // Documents real behaviour rather than asserting a guarantee the app does not make:
    // task creation is deliberately not idempotent, and two identical tasks are a
    // legitimate outcome (someone may genuinely need two). Recorded so that if an
    // idempotency key is ever added, this test is the place that has to change.
    const org = await buildOrg()

    await settle([
      asUser(org.employeeA1).post("/api/tasks").send({ title: "Double click" }),
      asUser(org.employeeA1).post("/api/tasks").send({ title: "Double click" })
    ])

    expect(await Task.countDocuments({ assignedTo: org.employeeA1._id, title: "Double click" })).toBe(2)
  })
})
