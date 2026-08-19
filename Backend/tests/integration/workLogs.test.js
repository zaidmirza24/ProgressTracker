import { describe, it, expect, beforeEach } from "vitest"
import DailyWorkLog from "../../models/DailyWorkLog.js"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask, makeStoppedSession } from "../factories/index.js"

// The daily work log.
//
// Two questions the endpoint used to conflate under one `role: "employee"` filter:
//   who may RECORD their own day?  -> everyone, since Iteration 15 made every role a
//                                     worker with tasks, timers and daily tasks
//   whose submission do I CHASE?   -> the people I manage, never myself
//
// Keeping those separate is the whole point of this file.

const submit = (actor, body = {}) =>
  asUser(actor).post("/api/daily-work-logs").send({ todaysWork: "Worked", hoursWorked: 7, ...body })

describe("who may submit a work log", () => {
  let org

  beforeEach(async () => { org = await buildOrg() })

  it.each([
    ["an employee", "employeeA1"],
    ["a manager", "managerA"],
    ["a super_admin", "superAdmin"]
  ])("accepts one from %s", async (_label, who) => {
    const res = await submit(org[who])
    expect(res.status).toBe(201)
    expect(res.body.log.employee._id).toBe(org[who]._id.toString())
  })

  it("always records the log against the caller, whatever the body claims", async () => {
    // There is no assignee field to widen today, but pinning it means adding one later
    // cannot quietly become an impersonation route.
    const res = await submit(org.managerA, { employee: org.employeeA1._id.toString() }).expect(201)
    expect(res.body.log.employee._id).toBe(org.managerA._id.toString())
  })

  it("still allows only one submission per person per day", async () => {
    await submit(org.managerA).expect(201)
    const second = await submit(org.managerA)

    expect(second.status).toBe(409)
    expect(second.body.code).toBe("LOG_ALREADY_SUBMITTED")
  })

  it("does not let one person submission block another", async () => {
    await submit(org.managerA).expect(201)
    await submit(org.employeeA1).expect(201)
    expect(await DailyWorkLog.countDocuments()).toBe(2)
  })

  it("validates hours", async () => {
    const res = await submit(org.managerA, { hoursWorked: 30 })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_HOURS")
  })

  it("requires the work description", async () => {
    await asUser(org.managerA).post("/api/daily-work-logs").send({ hoursWorked: 7 }).expect(400)
  })
})

describe("who can read which logs", () => {
  let org

  beforeEach(async () => {
    org = await buildOrg()
    await submit(org.employeeA1, { todaysWork: "Ana day" }).expect(201)
    await submit(org.employeeB1, { todaysWork: "Bo day" }).expect(201)
    await submit(org.managerA, { todaysWork: "Mia own day" }).expect(201)
  })

  const worksOf = (res) => res.body.logs.map(l => l.todaysWork).sort()

  it("shows an employee only their own", async () => {
    const res = await asUser(org.employeeA1).get("/api/daily-work-logs").expect(200)
    expect(worksOf(res)).toEqual(["Ana day"])
  })

  it("shows a manager their reports AND their own", async () => {
    // A page that hid your own submission from you would be plainly odd now that you
    // write one.
    const res = await asUser(org.managerA).get("/api/daily-work-logs").expect(200)
    expect(worksOf(res)).toEqual(["Ana day", "Mia own day"])
  })

  it("still keeps another reporting line out of view", async () => {
    const res = await asUser(org.managerA).get(`/api/daily-work-logs?employee=${org.employeeB1._id}`).expect(200)
    expect(res.body.logs).toEqual([])
  })

  it("lets a manager filter to their own logs by id", async () => {
    const res = await asUser(org.managerA).get(`/api/daily-work-logs?employee=${org.managerA._id}`).expect(200)
    expect(worksOf(res)).toEqual(["Mia own day"])
  })

  it("shows a super_admin everything", async () => {
    const res = await asUser(org.superAdmin).get("/api/daily-work-logs").expect(200)
    expect(res.body.logs).toHaveLength(3)
  })
})

describe("today context", () => {
  let org

  beforeEach(async () => { org = await buildOrg() })

  it("gives an employee what they finished and tracked, so the form is review-not-retype", async () => {
    const done = await makeTask({ assignedTo: org.employeeA1, title: "Shipped the report", status: "Completed" })
    await makeStoppedSession({ task: done, employee: org.employeeA1, seconds: 2 * 3600 })

    const res = await asUser(org.employeeA1).get("/api/daily-work-logs/today-context").expect(200)

    expect(res.body.completedToday.map(t => t.title)).toEqual(["Shipped the report"])
    expect(res.body.trackedHours).toBe(2)
    expect(res.body.alreadySubmitted).toBe(false)
  })

  it("reports once the caller has submitted", async () => {
    await submit(org.employeeA1).expect(201)
    const res = await asUser(org.employeeA1).get("/api/daily-work-logs/today-context").expect(200)
    expect(res.body.alreadySubmitted).toBe(true)
  })

  it("gives a manager their OWN context as well as the team compliance view", async () => {
    // The half that was missing: a manager could see who had not submitted, but had no
    // prefill of their own and no way to tell whether they themselves had.
    const done = await makeTask({ assignedTo: org.managerA, title: "Reviewed the quarter", status: "Completed" })
    await makeStoppedSession({ task: done, employee: org.managerA, seconds: 3600 })

    const res = await asUser(org.managerA).get("/api/daily-work-logs/today-context").expect(200)

    expect(res.body.completedToday.map(t => t.title)).toEqual(["Reviewed the quarter"])
    expect(res.body.trackedHours).toBe(1)
    expect(res.body.alreadySubmitted).toBe(false)
    expect(res.body.missing).toBeDefined()
  })

  it("chases a manager direct reports, and never the manager themselves", async () => {
    const res = await asUser(org.managerA).get("/api/daily-work-logs/today-context").expect(200)
    const names = res.body.missing.map(p => p.name)

    expect(names).toEqual(expect.arrayContaining([org.employeeA1.name, org.employeeA2.name]))
    expect(names).not.toContain(org.managerA.name)
    expect(names).not.toContain(org.employeeB1.name)
    expect(res.body.total).toBe(2)
  })

  it("moves a person from missing to submitted once they file", async () => {
    await submit(org.employeeA1).expect(201)
    const res = await asUser(org.managerA).get("/api/daily-work-logs/today-context").expect(200)

    expect(res.body.submitted.map(p => p.name)).toEqual([org.employeeA1.name])
    expect(res.body.missing.map(p => p.name)).toEqual([org.employeeA2.name])
  })

  it("has an admin chase managers as well as employees, but not themselves", async () => {
    const res = await asUser(org.superAdmin).get("/api/daily-work-logs/today-context").expect(200)
    const names = res.body.missing.map(p => p.name)

    expect(names).toEqual(expect.arrayContaining([org.managerA.name, org.managerB.name, org.employeeA1.name]))
    expect(names).not.toContain(org.superAdmin.name)
  })
})
