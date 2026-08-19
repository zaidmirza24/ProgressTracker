import { describe, it, expect, beforeEach } from "vitest"
import mongoose from "mongoose"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask, historyEntry } from "../factories/index.js"

// The list/detail split.
//
// `history` and `comments` are unbounded — they grow for as long as a task is worked on —
// and they were populated and sent on every row of every list. Measured against two years
// of data that made a manager's task list 54.9MB and 15.6 seconds
// (tests/perf/budgets.test.js). They are now summarised on the list and served in full by
// GET /api/tasks/:id, which is the only place anything renders them.
//
// The risk in that trade is losing a signal the list genuinely needed, so this file pins
// what each side must still carry.

const ABSENT_ID = new mongoose.Types.ObjectId().toString()

const withHistoryAndComments = (org) => makeTask({
  assignedTo: org.employeeA1,
  assignedBy: org.managerA,
  title: "Busy task",
  comments: [
    { text: "First note", author: org.managerA._id },
    { text: "Latest note", author: org.employeeA1._id }
  ],
  history: [
    historyEntry({ from: "In Progress", to: "In Review", changedBy: org.employeeA1 }),
    historyEntry({ from: "In Review", to: "In Progress", changedBy: org.managerA, comment: "Needs work" })
  ]
})

describe("GET /api/tasks — what the list carries", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await withHistoryAndComments(org)
  })

  const firstTask = async (actor = org.employeeA1) =>
    (await asUser(actor).get("/api/tasks").expect(200)).body.tasks[0]

  it("omits the unbounded arrays", async () => {
    const row = await firstTask()
    expect(row.history).toBeUndefined()
    expect(row.comments).toBeUndefined()
  })

  it("keeps the counts, so the UI can still show how much there is", async () => {
    const row = await firstTask()
    expect(row.historyCount).toBe(2)
    expect(row.commentCount).toBe(2)
  })

  it("keeps the latest comment, which the review queue shows inline", async () => {
    const row = await firstTask()
    expect(row.lastComment.text).toBe("Latest note")
    expect(row.lastComment.createdAt).toBeDefined()
  })

  it("reports no last comment when there are none", async () => {
    await makeTask({ assignedTo: org.employeeA2, title: "Quiet task" })
    const row = (await asUser(org.employeeA2).get("/api/tasks").expect(200)).body.tasks[0]

    expect(row.lastComment).toBeNull()
    expect(row.commentCount).toBe(0)
  })

  it("still derives reworkCount, which is computed FROM history", async () => {
    // The saving is in what is sent, not what is read — so no signal is lost.
    const row = await firstTask()
    expect(row.reworkCount).toBe(1)
  })

  it("still carries everything the task surfaces render", async () => {
    const row = await firstTask()
    expect(row).toMatchObject({
      title: "Busy task",
      status: expect.any(String),
      priority: expect.any(String),
      totalTrackedSeconds: expect.any(Number),
      isOverrun: expect.any(Boolean)
    })
    expect(row.assignedTo.name).toBeDefined()
    expect(row.assignedBy.name).toBeDefined()
  })
})

describe("GET /api/tasks/:id — the detail view", () => {
  let org, task

  beforeEach(async () => {
    org = await buildOrg()
    task = await withHistoryAndComments(org)
  })

  it("returns the full history and comments", async () => {
    const res = await asUser(org.employeeA1).get(`/api/tasks/${task._id}`).expect(200)

    expect(res.body.task.comments).toHaveLength(2)
    expect(res.body.task.history).toHaveLength(2)
  })

  it("populates who wrote each comment and who made each change", async () => {
    // Without this the timeline renders bare ids.
    const res = await asUser(org.employeeA1).get(`/api/tasks/${task._id}`).expect(200)

    expect(res.body.task.comments[0].author.name).toBe(org.managerA.name)
    expect(res.body.task.history[1].changedBy.name).toBe(org.managerA.name)
  })

  it("carries the derived fields too, so a detail view needs no second call", async () => {
    const res = await asUser(org.employeeA1).get(`/api/tasks/${task._id}`).expect(200)

    expect(res.body.task.totalTrackedSeconds).toBeDefined()
    expect(res.body.task.reworkCount).toBe(1)
    expect(res.body.task.isOverrun).toBeDefined()
  })

  describe("authorization", () => {
    it("refuses a coworker", async () => {
      // A detail view must not become a way to read a task you cannot otherwise touch.
      const res = await asUser(org.employeeA2).get(`/api/tasks/${task._id}`)
      expect(res.status).toBe(403)
    })

    it("refuses a manager from another reporting line", async () => {
      const res = await asUser(org.managerB).get(`/api/tasks/${task._id}`)
      expect(res.status).toBe(403)
    })

    it("allows the assignee, their manager and an admin", async () => {
      await asUser(org.employeeA1).get(`/api/tasks/${task._id}`).expect(200)
      await asUser(org.managerA).get(`/api/tasks/${task._id}`).expect(200)
      await asUser(org.superAdmin).get(`/api/tasks/${task._id}`).expect(200)
    })

    it("requires authentication", async () => {
      const res = await asUser(org.employeeA1).get(`/api/tasks/${task._id}`)
      expect(res.status).toBe(200)
    })
  })

  describe("missing tasks", () => {
    it("404s for an unknown id", async () => {
      await asUser(org.employeeA1).get(`/api/tasks/${ABSENT_ID}`).expect(404)
    })

    it("404s for a malformed id rather than throwing a cast error", async () => {
      await asUser(org.employeeA1).get("/api/tasks/not-an-id").expect(404)
    })

    it("404s for a cancelled task", async () => {
      await asUser(org.managerA).delete(`/api/tasks/${task._id}`).send({ reason: "Cancelled" }).expect(200)
      await asUser(org.employeeA1).get(`/api/tasks/${task._id}`).expect(404)
    })
  })

  it("does not shadow the static routes that sit above it", async () => {
    // /daily and /report are declared first; if :id had been registered above them it
    // would swallow both.
    await asUser(org.employeeA1).get("/api/tasks/daily").expect(200)
    await asUser(org.employeeA1).get("/api/tasks/report").expect(200)
  })
})
