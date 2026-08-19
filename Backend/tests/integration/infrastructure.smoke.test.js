import { describe, it, expect } from "vitest"
import mongoose from "mongoose"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import { api, asUser, asToken } from "../helpers/api.js"
import { MALFORMED_TOKEN, expiredTokenFor, forgedTokenFor } from "../helpers/auth.js"
import { countQueries, winningPlanStage } from "../helpers/queryCounter.js"
import { buildOrg, makeTask, makeRunningSession } from "../factories/index.js"

// Verifies the integration harness itself: the real Express app is reachable without a
// listening socket, the in-memory MongoDB enforces real constraints, factories persist,
// tokens authenticate, state is isolated between tests, and the instrumentation helpers
// report something meaningful.
//
// These are deliberately assertions about the HARNESS. The suites that assert product
// behaviour (authorization matrix, lifecycle, provisioning, report goldens) come next.

describe("integration test infrastructure", () => {
  it("serves the real Express app through supertest, with no port bound", async () => {
    const res = await api().get("/api/health").expect(200)
    expect(res.body.status).toBe("ok")
  })

  it("is connected to the per-worker in-memory database, never a real one", () => {
    expect(mongoose.connection.readyState).toBe(1)
    expect(mongoose.connection.name).toMatch(/^pt-test-/)
    expect(process.env.MONGO_TEST_URI).toBeDefined()
  })

  it("persists documents through the factories", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1, title: "Fixture task" })

    expect(org.everyone).toHaveLength(7)
    expect(org.employeeA1.manager.toString()).toBe(org.managerA._id.toString())
    expect(await Task.countDocuments()).toBe(1)
    // assignedBy defaults to the assignee, i.e. self-assigned.
    expect(task.assignedBy.toString()).toBe(org.employeeA1._id.toString())
  })

  it("isolates state between tests", async () => {
    // The previous test created a task; beforeEach must have cleared it.
    expect(await Task.countDocuments()).toBe(0)
    expect(await mongoose.model("User").countDocuments()).toBe(0)
  })

  it("authenticates a factory-minted token against the real middleware", async () => {
    const org = await buildOrg()
    const res = await asUser(org.employeeA1).get("/api/tasks").expect(200)
    expect(res.body.tasks).toEqual([])
  })

  it("rejects missing, malformed, expired and forged tokens", async () => {
    const org = await buildOrg()

    await api().get("/api/tasks").expect(401)
    await asToken(MALFORMED_TOKEN).get("/api/tasks").expect(401)
    await asToken(expiredTokenFor(org.employeeA1)).get("/api/tasks").expect(401)
    await asToken(forgedTokenFor(org.employeeA1)).get("/api/tasks").expect(401)
  })

  it("enforces real MongoDB indexes, including partial unique ones", async () => {
    const org = await buildOrg()
    const task = await makeTask({ assignedTo: org.employeeA1 })
    await makeRunningSession({ task, employee: org.employeeA1 })

    // The one-active-timer-per-employee guarantee is a database constraint, not just
    // application logic. If syncIndexes had not run, this second insert would succeed
    // and every concurrency test would be quietly meaningless.
    await expect(
      makeRunningSession({ task, employee: org.employeeA1 })
    ).rejects.toMatchObject({ code: 11000 })

    expect(await WorkSession.countDocuments({ stoppedAt: null })).toBe(1)
  })

  it("returns the production error contract, not development stack traces", async () => {
    const res = await api().get("/api/definitely-not-a-route").expect(404)
    expect(res.body).toMatchObject({ status: "fail" })
    expect(res.body.stack).toBeUndefined()
    expect(res.body.error).toBeTypeOf("string")
  })

  it("counts database operations, for N+1 budgets", async () => {
    const org = await buildOrg()
    await makeTask({ assignedTo: org.employeeA1 })

    const { count, byCollection } = await countQueries(() =>
      asUser(org.employeeA1).get("/api/tasks").expect(200)
    )

    expect(count).toBeGreaterThan(0)
    expect(byCollection.tasks).toBeGreaterThan(0)
  })

  it("can read query plans, for index-usage assertions", async () => {
    const org = await buildOrg()
    const stage = await winningPlanStage(
      Task.find({ assignedTo: org.employeeA1._id, isActive: true })
    )
    expect(stage).toBe("IXSCAN")
  })
})
