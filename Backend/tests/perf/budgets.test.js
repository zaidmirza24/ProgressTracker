import { describe, it, expect, beforeAll } from "vitest"
import { asUser } from "../helpers/api.js"
import { countQueries, winningPlanStage } from "../helpers/queryCounter.js"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import { seedVolume } from "./seedVolume.js"

// DATA-VOLUME BUDGETS.
//
// At roughly ten concurrent users, throughput is not the risk — data GROWTH is. These
// measure what happens after two years of ordinary use: the failure mode that arrives
// slowly enough that nobody notices until it is bad.
//
// WHAT IS ASSERTED, AND WHY NOT LATENCY:
// payload size and query count are properties of the CODE — bytes over the wire and
// round-trips to the database do not change with the hardware, so a regression in either
// is real wherever it is measured. Wall-clock time on an in-memory MongoDB on a developer
// laptop is not: it swung between 1.5s and 50s for the same request across runs of this
// very suite, purely from machine load. Asserting on it would produce exactly the flaky
// gate that teaches people to re-run instead of read. Timings are logged, never asserted.
//
// Sampled once rather than repeatedly: with nothing asserted on the timing there is no
// value in a best-of-N, and the fixture is large enough that repeats dominate the run.

const KB = 1024
const MB = 1024 * KB

const measure = async (request) => {
  const started = Date.now()
  const res = await request()
  const ms = Date.now() - started
  return { ms, bytes: Buffer.byteLength(JSON.stringify(res.body)) }
}

const report = (label, { ms, bytes }) =>
  console.log(`  ${label.padEnd(20)} ${String(ms).padStart(6)}ms  ${(bytes / KB).toFixed(0).padStart(6)}KB`)

describe("data-volume budgets", () => {
  let fixture

  beforeAll(async () => {
    fixture = await seedVolume()
  }, 300000)

  it("seeded a representative amount of data", async () => {
    expect(await Task.countDocuments()).toBe(fixture.taskCount)
    expect(await WorkSession.countDocuments()).toBeGreaterThan(10000)
  })

  it("keeps an employee's scoped list small", async () => {
    const result = await measure(() =>
      asUser(fixture.employees[0]).get("/api/tasks?scope=today").expect(200)
    )
    report("scope=today", result)
    expect(result.bytes).toBeLessThan(1 * MB)
  })

  it("keeps an employee's unscoped list small", async () => {
    const result = await measure(() =>
      asUser(fixture.employees[0]).get("/api/tasks").expect(200)
    )
    report("unscoped (1 user)", result)
    expect(result.bytes).toBeLessThan(1 * MB)
  })

  it("keeps a manager's whole-team list within budget", async () => {
    // The largest realistic list, and the one the manager dashboard requests on every
    // load. Before the list/detail split this was 54.9MB, because every row carried its
    // full unbounded `history` and `comments` arrays.
    const result = await measure(() =>
      asUser(fixture.manager).get("/api/tasks").expect(200)
    )
    report("unscoped (team)", result)
    expect(result.bytes).toBeLessThan(16 * MB)
  })

  it("keeps the progress report within budget", async () => {
    const result = await measure(() =>
      asUser(fixture.manager).get("/api/tasks/report").expect(200)
    )
    report("report", result)
    expect(result.bytes).toBeLessThan(4 * MB)
  })

  it("keeps the active-session lookup trivial", async () => {
    const result = await measure(() =>
      asUser(fixture.employees[0]).get("/api/work-sessions/active").expect(200)
    )
    report("active session", result)
    expect(result.bytes).toBeLessThan(10 * KB)
  })
})

describe("query counts", () => {
  let fixture

  beforeAll(async () => {
    fixture = await seedVolume({ tasks: 2000, sessions: 4000 })
  }, 300000)

  // The durable half of the perf story: an upper bound on ROUND TRIPS does not flake on
  // a slow machine, and it fails the moment someone adds a populate inside a loop.
  it("GET /api/tasks issues a constant number of queries", async () => {
    const { count, byCollection } = await countQueries(() =>
      asUser(fixture.manager).get("/api/tasks").expect(200)
    )
    console.log(`  GET /api/tasks -> ${count} queries`, byCollection)
    expect(count).toBeLessThanOrEqual(8)
  })

  it("GET /api/tasks/report issues a constant number of queries", async () => {
    const { count, byCollection } = await countQueries(() =>
      asUser(fixture.manager).get("/api/tasks/report").expect(200)
    )
    console.log(`  GET /api/tasks/report -> ${count} queries`, byCollection)
    // Measured at 13 against this fixture (users, departments, teams, tasks, work
    // sessions, absences, org settings) — set to the measured count rather than a guess,
    // same ratchet policy as the coverage floors: it may only move up, and a regression
    // that adds a query fails this immediately.
    expect(count).toBeLessThanOrEqual(13)
  })
})

describe("index usage", () => {
  let fixture

  beforeAll(async () => {
    fixture = await seedVolume({ tasks: 3000, sessions: 3000 })
  }, 300000)

  it("scans an index, not the collection, for an employee's task list", async () => {
    const stage = await winningPlanStage(
      Task.find({ assignedTo: fixture.employees[0]._id, isActive: true })
    )
    expect(stage).toBe("IXSCAN")
  })

  it("scans an index for the overdue query", async () => {
    const stage = await winningPlanStage(
      Task.find({ isActive: true, status: { $ne: "Completed" }, dueDate: { $lt: new Date() } })
    )
    expect(stage).toBe("IXSCAN")
  })

  it("scans an index for the active-timer lookup", async () => {
    const stage = await winningPlanStage(
      WorkSession.find({ employee: fixture.employees[0]._id, stoppedAt: null })
    )
    expect(stage).toBe("IXSCAN")
  })
})
