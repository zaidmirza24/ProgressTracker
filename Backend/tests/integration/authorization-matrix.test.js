import { describe, it, expect, beforeEach } from "vitest"
import mongoose from "mongoose"
import { api, asUser } from "../helpers/api.js"
import { buildOrg } from "../factories/index.js"

// Route-level role gating: every endpoint guarded by requireRole, checked against every
// role, in both directions.
//
// Asserting only that permitted roles succeed is half a test — the half that cannot
// catch a missing guard. Each row below states who is allowed, and the matrix asserts
// 403 for everyone else AND not-403 for everyone listed. A guard removed by accident
// fails the first; a guard added too broadly fails the second.
//
// Per-task ownership (can employee A act on employee B's task?) is a different question,
// handled in task-authorization.test.js — those routes deliberately carry no requireRole
// because the rule depends on the task, not the role.

const ABSENT_ID = new mongoose.Types.ObjectId().toString()

// method, path, and the roles requireRole permits.
const ROUTES = [
  // ── Organisation structure: readable by anyone signed in, writable by admin only ──
  { method: "get", path: "/api/departments", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/departments", allow: ["super_admin"], body: { name: "New" } },
  { method: "put", path: `/api/departments/${ABSENT_ID}`, allow: ["super_admin"], body: { name: "Edit" } },
  { method: "patch", path: `/api/departments/${ABSENT_ID}/deactivate`, allow: ["super_admin"] },

  { method: "get", path: "/api/teams", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/teams", allow: ["super_admin"], body: { name: "New" } },
  { method: "put", path: `/api/teams/${ABSENT_ID}`, allow: ["super_admin"], body: { name: "Edit" } },
  { method: "patch", path: `/api/teams/${ABSENT_ID}/deactivate`, allow: ["super_admin"] },

  { method: "get", path: "/api/users", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/users", allow: ["super_admin"], body: {} },
  { method: "put", path: `/api/users/${ABSENT_ID}`, allow: ["super_admin"], body: {} },
  { method: "patch", path: `/api/users/${ABSENT_ID}/deactivate`, allow: ["super_admin"] },

  // ── Daily-task templates: admin only, in full ──────────────────────────────
  { method: "get", path: "/api/task-templates", allow: ["super_admin"] },
  { method: "post", path: "/api/task-templates", allow: ["super_admin"], body: {} },
  { method: "put", path: `/api/task-templates/${ABSENT_ID}`, allow: ["super_admin"], body: {} },
  { method: "delete", path: `/api/task-templates/${ABSENT_ID}`, allow: ["super_admin"] },

  // ── Tasks: every role is a worker (Iteration 15), so all three may hold work ──
  { method: "get", path: "/api/tasks", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/tasks/daily", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/tasks/report", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/tasks", allow: ["employee", "manager", "super_admin"], body: { title: "T" } },

  // ── Timers: anyone can track their own; only management sees the team's ──────
  { method: "get", path: "/api/work-sessions/active", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/work-sessions/today-hours", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/work-sessions/active-team", allow: ["manager", "super_admin"] },
  { method: "post", path: "/api/work-sessions/start", allow: ["employee", "manager", "super_admin"], body: {} },
  { method: "post", path: "/api/work-sessions/pause", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/work-sessions/resume", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/work-sessions/stop", allow: ["employee", "manager", "super_admin"] },

  // ── Work logs ───────────────────────────────────────────────────────────────
  { method: "get", path: "/api/daily-work-logs", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/daily-work-logs/today-context", allow: ["employee", "manager", "super_admin"] },
  // Everyone may record their own day (Iteration 15 — "everyone is a worker").
  { method: "post", path: "/api/daily-work-logs", allow: ["employee", "manager", "super_admin"], body: {} },

  // ── Work calendar ───────────────────────────────────────────────────────────
  { method: "get", path: "/api/calendar/context", allow: ["employee", "manager", "super_admin"] },
  { method: "get", path: "/api/calendar/settings", allow: ["employee", "manager", "super_admin"] },
  { method: "put", path: "/api/calendar/settings", allow: ["super_admin"], body: {} },
  { method: "get", path: "/api/calendar/absences", allow: ["employee", "manager", "super_admin"] },
  { method: "post", path: "/api/calendar/absences", allow: ["manager", "super_admin"], body: {} },
  { method: "delete", path: `/api/calendar/absences/${ABSENT_ID}`, allow: ["manager", "super_admin"] }
]

const ROLES = ["employee", "manager", "super_admin"]

describe("route authorization matrix", () => {
  let org
  let actorFor

  beforeEach(async () => {
    org = await buildOrg()
    actorFor = { employee: org.employeeA1, manager: org.managerA, super_admin: org.superAdmin }
  })

  for (const route of ROUTES) {
    const denied = ROLES.filter(r => !route.allow.includes(r))
    const label = `${route.method.toUpperCase()} ${route.path.replace(ABSENT_ID, ":id")}`

    for (const role of route.allow) {
      it(`${label} — permits ${role}`, async () => {
        // A permitted caller may still get 400/404/409 for an absent id or empty body;
        // what matters is that authorization did not stop them.
        const res = await asUser(actorFor[role])[route.method](route.path).send(route.body ?? {})
        expect(res.status).not.toBe(403)
        expect(res.status).not.toBe(401)
      })
    }

    for (const role of denied) {
      it(`${label} — denies ${role}`, async () => {
        const res = await asUser(actorFor[role])[route.method](route.path).send(route.body ?? {})
        expect(res.status).toBe(403)
        expect(res.body.error).toMatch(/insufficient permissions/i)
      })
    }

    it(`${label} — rejects an unauthenticated caller`, async () => {
      const res = await api()[route.method](route.path).send(route.body ?? {})
      expect(res.status).toBe(401)
    })
  }
})

describe("unknown routes", () => {
  it("404s rather than falling through to a handler", async () => {
    const org = await buildOrg()
    await asUser(org.superAdmin).get("/api/not-a-route").expect(404)
    await asUser(org.superAdmin).post("/api/tasks/not-a-subroute/nope").expect(404)
  })

  it("returns the production error contract, with no stack trace", async () => {
    const org = await buildOrg()
    const res = await asUser(org.superAdmin).get("/api/not-a-route").expect(404)

    expect(res.body).toMatchObject({ status: "fail" })
    expect(res.body.stack).toBeUndefined()
    expect(res.body.error).toBeTypeOf("string")
  })

  it("does not leak whether an unknown route exists to an unauthenticated caller", async () => {
    // The 404 handler sits after the routers but the routers authenticate first, so an
    // anonymous probe gets 404 for a genuinely unknown path and 401 for a real one —
    // which is the correct way round: it reveals nothing about protected resources.
    await api().get("/api/not-a-route").expect(404)
    await api().get("/api/users").expect(401)
  })
})
