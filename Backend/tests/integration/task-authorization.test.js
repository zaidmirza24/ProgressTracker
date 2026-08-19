import { describe, it, expect, beforeEach } from "vitest"
import mongoose from "mongoose"
import Task from "../../models/Task.js"
import { asUser } from "../helpers/api.js"
import { buildOrg, makeTask, makeDailyTask } from "../factories/index.js"

// Per-task authorization: not "what role are you?" but "is this task yours to touch?".
//
// These routes deliberately carry no requireRole — the rule depends on the task, so it
// lives in the controller (hasTaskAccess). That is exactly the shape of guard that goes
// missing: Iteration 14 found that updateTaskStatus and addComment had none at all, so
// any authenticated employee could act on ANY task id, and startSession let an employee
// run a timer on a coworker's task. This file is the standing guard against a third.
//
// The scope being enforced, mirroring getTasks' own visibility filter:
//   employee    → only tasks assigned to them
//   manager     → tasks they created, tasks assigned to them, and their direct reports'
//   super_admin → unrestricted

const ABSENT_ID = new mongoose.Types.ObjectId().toString()

describe("task-level authorization", () => {
  let org
  let victimTask     // belongs to employeeA2
  let ownTask        // belongs to employeeA1

  beforeEach(async () => {
    org = await buildOrg()
    victimTask = await makeTask({ assignedTo: org.employeeA2, title: "A coworker's task" })
    ownTask = await makeTask({ assignedTo: org.employeeA1, title: "My own task" })
  })

  // Every route that acts on a single task, with a body that would otherwise succeed.
  const actions = [
    { name: "change status", run: (actor, id) => asUser(actor).put(`/api/tasks/${id}/status`).send({ status: "In Progress" }) },
    { name: "add a comment", run: (actor, id) => asUser(actor).post(`/api/tasks/${id}/comments`).send({ text: "hello" }) },
    { name: "edit fields", run: (actor, id) => asUser(actor).patch(`/api/tasks/${id}`).send({ title: "Renamed" }) },
    { name: "mark blocked", run: (actor, id) => asUser(actor).patch(`/api/tasks/${id}/blocked`).send({ isBlocked: true, reason: "stuck" }) },
    { name: "cancel", run: (actor, id) => asUser(actor).delete(`/api/tasks/${id}`).send({ reason: "not needed" }) },
    { name: "start a timer", run: (actor, id) => asUser(actor).post("/api/work-sessions/start").send({ taskId: id }) }
  ]

  for (const action of actions) {
    it(`an employee cannot ${action.name} on a coworker's task`, async () => {
      const res = await action.run(org.employeeA1, victimTask._id)
      expect(res.status).toBe(403)
    })

    it(`an employee cannot ${action.name} on a task in another reporting line`, async () => {
      const otherLineTask = await makeTask({ assignedTo: org.employeeB1 })
      const res = await action.run(org.employeeA1, otherLineTask._id)
      expect(res.status).toBe(403)
    })

    it(`an unrelated manager cannot ${action.name} on someone else's report's task`, async () => {
      // managerB has no authority over employeeA2, who reports to managerA.
      const res = await action.run(org.managerB, victimTask._id)
      expect(res.status).toBe(403)
    })
  }

  it("leaves the coworker's task completely untouched after a rejected attempt", async () => {
    // A 403 that still wrote something would be worse than no guard at all.
    const before = await Task.findById(victimTask._id).lean()

    for (const action of actions) {
      await action.run(org.employeeA1, victimTask._id)
    }

    const after = await Task.findById(victimTask._id).lean()
    expect(after.status).toBe(before.status)
    expect(after.title).toBe(before.title)
    expect(after.isBlocked).toBe(before.isBlocked)
    expect(after.isActive).toBe(true)
    expect(after.comments).toHaveLength(0)
    expect(after.history).toHaveLength(0)
  })

  describe("what each actor may legitimately do", () => {
    it("lets an employee act on their own task", async () => {
      const res = await asUser(org.employeeA1).put(`/api/tasks/${ownTask._id}/status`).send({ status: "In Progress" })
      expect(res.status).toBe(200)
    })

    it("lets the assignee's own manager act on it", async () => {
      const res = await asUser(org.managerA).post(`/api/tasks/${victimTask._id}/comments`).send({ text: "nice work" })
      expect(res.status).toBe(200)
    })

    it("lets a manager act on a task they created for someone outside their line", async () => {
      // Authorship is its own claim — otherwise a manager could assign work and then be
      // unable to review it.
      const crossLine = await makeTask({ assignedTo: org.employeeB1, assignedBy: org.managerA })
      const res = await asUser(org.managerA).post(`/api/tasks/${crossLine._id}/comments`).send({ text: "checking in" })
      expect(res.status).toBe(200)
    })

    it("lets a super_admin act on anything", async () => {
      const res = await asUser(org.superAdmin).post(`/api/tasks/${victimTask._id}/comments`).send({ text: "org-wide" })
      expect(res.status).toBe(200)
    })

    it("does not let an employee with no manager reach anyone else's work", async () => {
      const res = await asUser(org.unmanaged).post(`/api/tasks/${victimTask._id}/comments`).send({ text: "nope" })
      expect(res.status).toBe(403)
    })
  })

  describe("absent tasks", () => {
    it("404s rather than 403s, and never reveals whether the id exists", async () => {
      const res = await asUser(org.employeeA1).post(`/api/tasks/${ABSENT_ID}/comments`).send({ text: "x" })
      expect(res.status).toBe(404)
    })

    it("treats a cancelled task as absent", async () => {
      await Task.updateOne({ _id: ownTask._id }, { isActive: false })
      const res = await asUser(org.employeeA1).post(`/api/tasks/${ownTask._id}/comments`).send({ text: "x" })
      expect(res.status).toBe(404)
    })
  })
})

describe("field-level authorization on PATCH /api/tasks/:id", () => {
  let org
  let selfCreated
  let assignedByManager

  beforeEach(async () => {
    org = await buildOrg()
    selfCreated = await makeTask({ assignedTo: org.employeeA1 }) // assignedBy defaults to self
    assignedByManager = await makeTask({ assignedTo: org.employeeA1, assignedBy: org.managerA })
  })

  it("rejects mass assignment of fields that are not editable", async () => {
    // status has its own endpoint and its own workflow rules; isActive is cancellation;
    // history is the audit trail. None may be set through a field edit.
    for (const payload of [
      { status: "Completed" },
      { isActive: false },
      { history: [] },
      { assignedBy: org.employeeA1._id.toString() },
      { isBlocked: true }
    ]) {
      const res = await asUser(org.managerA).patch(`/api/tasks/${assignedByManager._id}`).send(payload)
      expect(res.status).toBe(403)
      expect(res.body.code).toBe("FIELD_NOT_EDITABLE")
    }
  })

  it("does not let an employee widen their own field set", async () => {
    // An employee may edit their own self-created task, but only within a narrower list
    // than a manager's — reassignment and department are not theirs to change.
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${selfCreated._id}`)
      .send({ assignedTo: org.employeeA2._id.toString() })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("FIELD_NOT_EDITABLE")
  })

  it("does not let an employee edit work a manager assigned to them", async () => {
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${assignedByManager._id}`).send({ title: "Renamed" })
    expect(res.status).toBe(403)
  })

  it("lets an employee edit the task they created themselves", async () => {
    const res = await asUser(org.employeeA1).patch(`/api/tasks/${selfCreated._id}`).send({ title: "Renamed" })
    expect(res.status).toBe(200)
    expect(res.body.task.title).toBe("Renamed")
  })

  it("stops a manager reassigning work outside their own reporting line", async () => {
    const res = await asUser(org.managerA).patch(`/api/tasks/${assignedByManager._id}`)
      .send({ assignedTo: org.employeeB1._id.toString() })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("ASSIGNEE_OUT_OF_SCOPE")
  })

  it("lets a manager reassign within their own line", async () => {
    const res = await asUser(org.managerA).patch(`/api/tasks/${assignedByManager._id}`)
      .send({ assignedTo: org.employeeA2._id.toString() })
    expect(res.status).toBe(200)
  })

  it("refuses to reassign a daily task, which belongs to its own cycle", async () => {
    const daily = await makeDailyTask({ assignedTo: org.employeeA1 })
    const res = await asUser(org.managerA).patch(`/api/tasks/${daily._id}`)
      .send({ assignedTo: org.employeeA2._id.toString() })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe("DAILY_TASK_NOT_REASSIGNABLE")
  })

  it("refuses an assignee who is not an active user", async () => {
    const res = await asUser(org.managerA).patch(`/api/tasks/${assignedByManager._id}`)
      .send({ assignedTo: ABSENT_ID })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("INVALID_ASSIGNEE")
  })
})

describe("GET /api/tasks — visibility scope", () => {
  let org

  beforeEach(async () => {
    org = await buildOrg()
    await makeTask({ assignedTo: org.employeeA1, title: "A1 own" })
    await makeTask({ assignedTo: org.employeeA2, title: "A2 own" })
    await makeTask({ assignedTo: org.employeeB1, title: "B1 own" })
    await makeTask({ assignedTo: org.unmanaged, title: "unmanaged own" })
  })

  const titles = (res) => res.body.tasks.map(t => t.title).sort()

  it("shows an employee only their own tasks", async () => {
    const res = await asUser(org.employeeA1).get("/api/tasks").expect(200)
    expect(titles(res)).toEqual(["A1 own"])
  })

  it("shows a manager their own line and nobody else's", async () => {
    const res = await asUser(org.managerA).get("/api/tasks").expect(200)
    expect(titles(res)).toEqual(["A1 own", "A2 own"])
  })

  it("shows a super_admin everything", async () => {
    const res = await asUser(org.superAdmin).get("/api/tasks").expect(200)
    expect(titles(res)).toHaveLength(4)
  })

  it("does not let ?assignedTo widen an employee's scope", async () => {
    // The parameter narrows WITHIN the caller's scope; it never widens it. Anything
    // else would make the whole visibility filter bypassable with a query string.
    const res = await asUser(org.employeeA1)
      .get(`/api/tasks?assignedTo=${org.employeeA2._id}`)
      .expect(200)

    expect(res.body.tasks).toEqual([])
  })

  it("does not let ?assignedTo widen a manager's scope", async () => {
    const res = await asUser(org.managerA)
      .get(`/api/tasks?assignedTo=${org.employeeB1._id}`)
      .expect(200)

    expect(res.body.tasks).toEqual([])
  })

  it("narrows correctly within scope", async () => {
    const res = await asUser(org.managerA)
      .get(`/api/tasks?assignedTo=${org.employeeA2._id}`)
      .expect(200)

    expect(titles(res)).toEqual(["A2 own"])
  })

  describe("query parameter injection", () => {
    // Two different vectors, with genuinely different outcomes under Express 5.
    //
    // Express 5 defaults its query parser to `simple` (Node's querystring), NOT the
    // `extended` qs parser Express 4 used. Verified against this app's express@5.2.1:
    // `?status[$ne]=Completed` yields the literal key "status[$ne]", so `req.query.status`
    // is undefined and no operator object is ever constructed. `?status=a&status=b`,
    // however, still yields an ARRAY — which is what the controller's `typeof !== "string"`
    // guard actually catches.

    it("ignores bracket syntax entirely — no operator reaches the query", async () => {
      const res = await asUser(org.employeeA1).get("/api/tasks?status[$ne]=Completed").expect(200)

      // The filter simply is not applied, and crucially the caller's visibility scope is
      // untouched: they still see only their own task, not everyone's.
      expect(titles(res)).toEqual(["A1 own"])
    })

    it("ignores bracket syntax on assignedTo without widening scope", async () => {
      const res = await asUser(org.employeeA1).get("/api/tasks?assignedTo[$ne]=null").expect(200)
      expect(titles(res)).toEqual(["A1 own"])
    })

    it("rejects a repeated status parameter, which does arrive as an array", async () => {
      // The load-bearing case for the `typeof status !== "string"` guard, and the one
      // that would become an operator object if the query parser were ever switched
      // back to `extended`.
      const res = await asUser(org.employeeA1).get("/api/tasks?status=Completed&status=Pending")
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("INVALID_STATUS")
    })

    it("rejects a repeated assignedTo parameter", async () => {
      const res = await asUser(org.employeeA1)
        .get(`/api/tasks?assignedTo=${org.employeeA1._id}&assignedTo=${org.employeeA2._id}`)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("INVALID_ASSIGNEE")
    })

    it("rejects a status that is not part of the workflow", async () => {
      const res = await asUser(org.employeeA1).get("/api/tasks?status=Approved")
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("INVALID_STATUS")
    })

    it("rejects a malformed ObjectId rather than casting it", async () => {
      const res = await asUser(org.employeeA1).get("/api/tasks?assignedTo=not-an-id")
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("INVALID_ASSIGNEE")
    })

    it("rejects an unknown scope", async () => {
      const res = await asUser(org.employeeA1).get("/api/tasks?scope=forever")
      expect(res.status).toBe(400)
      expect(res.body.code).toBe("INVALID_SCOPE")
    })

    it("clamps a hostile pagination limit instead of honouring it", async () => {
      // An unbounded `limit` is a cheap way to force the server to serialise everything
      // the caller can see.
      const res = await asUser(org.employeeA1).get("/api/tasks?limit=100000&page=1").expect(200)
      expect(res.body.limit).toBeLessThanOrEqual(200)
    })
  })
})

describe("POST /api/tasks — assignment authority", () => {
  let org

  beforeEach(async () => {
    org = await buildOrg()
  })

  it("forces an employee's task to themselves, whatever they ask for", async () => {
    // Never trust the client to say who work belongs to.
    const res = await asUser(org.employeeA1).post("/api/tasks")
      .send({ title: "Sneaky", assignedTo: org.employeeA2._id.toString() })
      .expect(201)

    expect(res.body.task.assignedTo._id).toBe(org.employeeA1._id.toString())
  })

  it("defaults a manager's task to themselves when no assignee is given", async () => {
    // What lets the same self-assign modal serve a manager's own "My Work" page.
    const res = await asUser(org.managerA).post("/api/tasks").send({ title: "My own work" }).expect(201)
    expect(res.body.task.assignedTo._id).toBe(org.managerA._id.toString())
  })

  it("lets a manager assign to someone else", async () => {
    const res = await asUser(org.managerA).post("/api/tasks")
      .send({ title: "For Ana", assignedTo: org.employeeA1._id.toString() })
      .expect(201)

    expect(res.body.task.assignedTo._id).toBe(org.employeeA1._id.toString())
  })
})

describe("GET /api/tasks/report — reporting scope", () => {
  let org

  beforeEach(async () => {
    org = await buildOrg()
  })

  it("shows an employee only their own row, and no org-wide analytics", async () => {
    const res = await asUser(org.employeeA1).get("/api/tasks/report").expect(200)

    expect(res.body.employeeReport).toHaveLength(1)
    expect(res.body.employeeReport[0]._id).toBe(org.employeeA1._id.toString())
    // Department/team/health breakdowns are management views.
    expect(res.body.departmentReport).toBeUndefined()
    expect(res.body.healthReport).toBeUndefined()
  })

  it("scopes a manager to their own direct reports plus themselves", async () => {
    const res = await asUser(org.managerA).get("/api/tasks/report").expect(200)
    const ids = res.body.employeeReport.map(r => r._id).sort()

    expect(ids).toEqual([org.employeeA1._id.toString(), org.employeeA2._id.toString(), org.managerA._id.toString()].sort())
  })

  it("gives a super_admin the whole organisation", async () => {
    const res = await asUser(org.superAdmin).get("/api/tasks/report").expect(200)
    expect(res.body.employeeReport.length).toBe(org.everyone.length)
    expect(res.body.healthReport).toBeDefined()
  })
})

describe("GET /api/work-sessions/active-team — team visibility", () => {
  it("shows a manager only their own line, plus themselves", async () => {
    const org = await buildOrg()
    const ownTask = await makeTask({ assignedTo: org.employeeA1 })
    const otherTask = await makeTask({ assignedTo: org.employeeB1 })

    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: ownTask._id }).expect(201)
    await asUser(org.employeeB1).post("/api/work-sessions/start").send({ taskId: otherTask._id }).expect(201)

    const res = await asUser(org.managerA).get("/api/work-sessions/active-team").expect(200)
    const names = res.body.activeWork.map(w => w.employee.name)

    expect(names).toEqual([org.employeeA1.name])
  })

  it("shows a super_admin everyone who is tracking time", async () => {
    const org = await buildOrg()
    const t1 = await makeTask({ assignedTo: org.employeeA1 })
    const t2 = await makeTask({ assignedTo: org.employeeB1 })
    await asUser(org.employeeA1).post("/api/work-sessions/start").send({ taskId: t1._id }).expect(201)
    await asUser(org.employeeB1).post("/api/work-sessions/start").send({ taskId: t2._id }).expect(201)

    const res = await asUser(org.superAdmin).get("/api/work-sessions/active-team").expect(200)
    expect(res.body.activeWork).toHaveLength(2)
  })
})

describe("GET /api/daily-work-logs — log visibility", () => {
  it("does not let a manager read logs outside their line via ?employee", async () => {
    const org = await buildOrg()
    await asUser(org.employeeB1).post("/api/daily-work-logs")
      .send({ todaysWork: "Other line work", hoursWorked: 7 })
      .expect(201)

    const res = await asUser(org.managerA).get(`/api/daily-work-logs?employee=${org.employeeB1._id}`).expect(200)
    expect(res.body.logs).toEqual([])
  })

  it("shows an employee only their own logs", async () => {
    const org = await buildOrg()
    await asUser(org.employeeA1).post("/api/daily-work-logs")
      .send({ todaysWork: "Mine", hoursWorked: 7 }).expect(201)
    await asUser(org.employeeA2).post("/api/daily-work-logs")
      .send({ todaysWork: "Theirs", hoursWorked: 7 }).expect(201)

    const res = await asUser(org.employeeA1).get("/api/daily-work-logs").expect(200)
    expect(res.body.logs).toHaveLength(1)
    expect(res.body.logs[0].todaysWork).toBe("Mine")
  })
})

describe("calendar absence scope", () => {
  it("stops a manager recording absence for someone outside their line", async () => {
    const org = await buildOrg()
    const res = await asUser(org.managerA).post("/api/calendar/absences").send({
      employee: org.employeeB1._id.toString(),
      startDate: "2026-03-16",
      endDate: "2026-03-16"
    })

    expect(res.status).toBe(403)
    expect(res.body.code).toBe("FORBIDDEN")
  })

  it("lets a manager record absence for their own report", async () => {
    const org = await buildOrg()
    const res = await asUser(org.managerA).post("/api/calendar/absences").send({
      employee: org.employeeA1._id.toString(),
      startDate: "2026-03-16",
      endDate: "2026-03-16"
    })

    expect(res.status).toBe(201)
  })

  it("shows an employee only their own absences", async () => {
    const org = await buildOrg()
    await asUser(org.managerA).post("/api/calendar/absences").send({
      employee: org.employeeA2._id.toString(), startDate: "2026-03-16", endDate: "2026-03-16"
    }).expect(201)

    const res = await asUser(org.employeeA1).get("/api/calendar/absences").expect(200)
    expect(res.body.absences).toEqual([])
  })
})
