import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { asUser } from "../helpers/api.js"
import { freezeTime, restoreTime } from "../helpers/clock.js"
import { expectMatchesGolden } from "../helpers/golden.js"
import { buildReportFixture, REPORT_NOW } from "../factories/reportFixture.js"
import { makeTask, makeStoppedSession, setOrgSettings, makeAbsence, makeDepartment, makeUser } from "../factories/index.js"

// GET /api/tasks/report — the single most consequential endpoint in the app, and the
// one a manager makes decisions from.
//
// Every number below is hand-derived from the fixture in factories/reportFixture.js and
// stated as an explicit expectation, because a metric's DEFINITION is the thing under
// test (Standards §14): what is the denominator, what counts as completed, when does a
// figure not apply at all. The golden at the end then covers the whole response shape,
// so a field added, removed or renamed shows up as a reviewable diff rather than
// silently breaking a consumer.

const rowFor = (res, user) => res.body.employeeReport.find(r => r._id === user._id.toString())

describe("progress report", () => {
  let fixture

  beforeEach(async () => {
    freezeTime(REPORT_NOW)
    fixture = await buildReportFixture()
  })

  afterEach(() => restoreTime())

  describe("task counts", () => {
    it("counts each status exactly once", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.total).toBe(7)
      expect(ana.completed).toBe(3)      // daily standup, vendor summary, onboarding pack
      expect(ana.inProgress).toBe(1)     // payment reconciliation
      expect(ana.pending).toBe(1)        // data migration (paused and blocked)
    })

    it("averages progress across every task", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      // 100 + 0 + 50 + 0 + 100 + 100 + 50 = 400 over 7 tasks → 57%.
      expect(rowFor(res, fixture.ana).avgProgress).toBe(57)
    })

    it("counts overdue from the deadline, not from the report's date filter", async () => {
      // Overdue is an absolute, always-current signal — switching the timeframe
      // dropdown must never change what counts as overdue.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).overdue).toBe(1) // quarterly filing, due last Friday
    })

    it("does not treat work due later today as overdue", async () => {
      // The reconciliation task is due at 23:00 and the clock reads 10:00.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).overdue).toBe(1)
    })
  })

  describe("completion rates, kept separate (Locked Logic §7)", () => {
    it("reports daily and assigned rates independently, with overall as a derived summary", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.dailyCompletionRate).toBe(50)      // 1 of 2 daily tasks
      expect(ana.assignedCompletionRate).toBe(40)   // 2 of 5 assigned tasks
      expect(ana.assignedTotal).toBe(5)
      expect(ana.overallCompletionRate).toBe(43)    // 3 of 7, rounded
      expect(ana.completionRate).toBe(ana.overallCompletionRate)
    })

    it("splits new daily work from carried-forward work (Locked Logic §8)", async () => {
      // A carried-forward task must never be counted as brand new — that would make a
      // backlog look like fresh throughput.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.dailyNewCount).toBe(1)
      expect(ana.dailyCarriedForwardCount).toBe(1)
    })
  })

  describe("time and estimation", () => {
    it("sums tracked time across every session", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      // 1h standup + 4h reconciliation + 2h vendor summary + 2h onboarding = 9h
      expect(rowFor(res, fixture.ana).totalTrackedSeconds).toBe(9 * 3600)
    })

    it("measures estimation accuracy over completed, estimated work only", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      // Estimated 1 + 2 + 1 = 4h against 1 + 2 + 2 = 5h tracked → 80%.
      expect(rowFor(res, fixture.ana).estimationAccuracy).toBe(80)
    })

    it("reports accuracy as null, not a vast percentage, when nothing was tracked", async () => {
      // A task can legitimately be completed with no time logged. Dividing by a floor
      // once turned that into a nonsensical >4000% figure instead of "not measurable".
      const other = fixture.org.employeeA2
      await makeTask({ assignedTo: other, title: "Estimated but never timed", estimatedHours: 3, status: "Completed" })

      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, other).estimationAccuracy).toBeNull()
    })

    it("defaults accuracy to 100 when no estimates were set at all", async () => {
      // employeeA2 has no tasks in this fixture, so there is nothing to measure against.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.org.employeeA2).estimationAccuracy).toBe(100)
    })
  })

  describe("capacity and utilisation, as two separate metrics (Locked Logic §7)", () => {
    it("reports planned and actual utilisation separately against the day's capacity", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      // Capacity 8h − 1h break = 7h. Landing today: 1h standup + 1h triage + 3h
      // reconciliation = 5h planned. Tracked today: 1h + 4h = 5h actual.
      expect(ana.capacityHoursToday).toBe(7)
      expect(ana.plannedUtilizationPct).toBe(71)
      expect(ana.actualUtilizationPct).toBe(71)
      expect(ana.isCapacityOverrunToday).toBe(false)
    })

    it("flags actual overrun as its own signal, distinct from utilisation", async () => {
      const heavy = fixture.org.employeeA2
      const task = await makeTask({ assignedTo: heavy, dueDate: REPORT_NOW, estimatedHours: 1 })
      await makeStoppedSession({ task, employee: heavy, seconds: 9 * 3600, startedAt: REPORT_NOW })

      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const row = rowFor(res, heavy)

      expect(row.isCapacityOverrunToday).toBe(true)
      expect(row.actualUtilizationPct).toBeGreaterThan(100)
    })

    it("reports utilisation as null on a day with no capacity, never as 0%", async () => {
      // Nobody is "0% utilised" on a day off — the question does not apply (§41).
      await setOrgSettings({ workingDays: [1, 2, 3, 4, 5], holidays: [{ date: REPORT_NOW, name: "Founders Day" }] })

      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.capacityHoursToday).toBe(0)
      expect(ana.capacityReasonToday).toBe("holiday")
      expect(ana.isWorkingDayToday).toBe(false)
      expect(ana.plannedUtilizationPct).toBeNull()
      expect(ana.actualUtilizationPct).toBeNull()
      expect(ana.isCapacityOverrunToday).toBe(false)
    })

    it("explains leave as leave rather than as idleness", async () => {
      await makeAbsence({
        employee: fixture.ana, createdBy: fixture.manager,
        startDate: REPORT_NOW, endDate: REPORT_NOW, type: "leave"
      })

      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.capacityReasonToday).toBe("leave")
      expect(ana.isWorkingDayToday).toBe(true)   // it IS a working day; this person is away
      expect(ana.plannedUtilizationPct).toBeNull()
    })

    it("halves capacity on a half day", async () => {
      await makeAbsence({
        employee: fixture.ana, createdBy: fixture.manager,
        startDate: REPORT_NOW, endDate: REPORT_NOW, type: "half_day"
      })

      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).capacityHoursToday).toBe(3.5)
    })
  })

  describe("quality and rework (Locked Logic §9)", () => {
    it("rates first-pass approval over review-gated work only", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      // Two completed tasks went through review; one was returned once.
      expect(ana.reviewedTaskCount).toBe(2)
      expect(ana.firstPassApprovalRate).toBe(50)
      expect(ana.reworkRate).toBe(50)
    })

    it("does not flag a quality signal on too small a sample", async () => {
      // 50% rework looks alarming until you notice the denominator is 2. Small samples
      // are deliberately not flagged, mirroring the estimation-pattern rule.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).hasQualitySignal).toBe(false)
    })

    it("reports null, not 0%, for someone with no review-gated work", async () => {
      // An employee on mostly daily work has no first-pass rate to report — 0% would
      // read as a damning judgement of work that was never reviewed at all.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const row = rowFor(res, fixture.org.employeeA2)

      expect(row.reviewedTaskCount).toBe(0)
      expect(row.firstPassApprovalRate).toBeNull()
      expect(row.reworkRate).toBeNull()
    })

    it("traces a rework flag back to the task and the feedback given", async () => {
      // Any flagged problem must be traceable to the specific task that caused it (§12).
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.reworkedTasks).toHaveLength(1)
      expect(ana.reworkedTasks[0]).toMatchObject({
        title: "Client onboarding pack",
        reworkCount: 1,
        lastFeedback: "Missing the pricing appendix"
      })
    })
  })

  describe("backlog: paused and blocked are different things (Locked Logic §8)", () => {
    it("counts blocked work separately and ages it in working days", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      // Blocked the previous Wednesday. Wed, Thu, Fri, Mon = 4 working days inclusive,
      // minus the day it was raised = 3. The weekend must not inflate it.
      expect(ana.blockedCount).toBe(1)
      expect(ana.blockedBacklogAvgAgeDays).toBe(3)
      expect(ana.blockedBacklogOldestAgeDays).toBe(3)
    })

    it("does not count a blocked task as merely paused", async () => {
      // "Pending" used to conflate "the timer is off" with "this is stuck". Only the
      // second is a backlog worth ageing.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).pausedCount).toBe(0)
    })

    it("keeps the deprecated aliases pointing at the blocked figures", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      expect(ana.pendingBacklogAvgAgeDays).toBe(ana.blockedBacklogAvgAgeDays)
      expect(ana.pendingBacklogOldestAgeDays).toBe(ana.blockedBacklogOldestAgeDays)
    })

    it("lists each blocked task with its reason, so a manager can unblock on the spot", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      expect(rowFor(res, fixture.ana).blockedTasks[0]).toMatchObject({
        title: "Data migration",
        reason: "Waiting on the vendor's export",
        ageDays: 3
      })
    })
  })

  describe("estimation pattern (Locked Logic §10)", () => {
    it("does not flag a pattern when only a minority of recent work overran", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      // 1 of 3 recent estimated tasks overran — above the minimum sample, below the
      // threshold. Being just under the line is the case worth pinning.
      expect(ana.recentEstimatedTasks).toHaveLength(3)
      expect(ana.recentOverrunProportion).toBe(0.33)
      expect(ana.hasOverrunPattern).toBe(false)
    })

    it("does not count work that finished exactly on estimate as an overrun", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const onEstimate = rowFor(res, fixture.ana).recentEstimatedTasks
        .find(t => t.title === "Vendor summary")

      expect(onEstimate.isOverrun).toBe(false)
      expect(onEstimate.overrunPercentage).toBe(0)
    })

    it("retains the underlying tasks so a flag is always investigable", async () => {
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const overran = rowFor(res, fixture.ana).recentEstimatedTasks
        .find(t => t.title === "Client onboarding pack")

      expect(overran).toMatchObject({ estimatedHours: 1, trackedHours: 2, overrunPercentage: 100, isOverrun: true })
    })
  })

  describe("org-wide sections", () => {
    it("summarises task health across the visible organisation", async () => {
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)

      expect(res.body.healthReport).toMatchObject({
        totalTasks: 7, completedTasks: 3, inProgressTasks: 1,
        notStartedTasks: 2, pendingTasks: 1, inReviewTasks: 0,
        overdueTasks: 1, blockedTasks: 1, reworkedTasks: 1
      })
    })

    it("breaks tasks down by priority", async () => {
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)
      const medium = res.body.priorityReport.find(p => p.priority === "medium")

      expect(medium.total).toBe(7)
      expect(medium.completed).toBe(3)
      expect(medium.overdue).toBe(1)
    })

    it("groups teams by the PERSON's team", async () => {
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)
      const team = res.body.teamReport.find(t => t.name === "Platform")

      expect(team.total).toBe(7)
      expect(team.memberCount).toBe(fixture.org.everyone.length)
    })

    it("groups departments by the person, when the task carries no department of its own", async () => {
      // The two breakdowns now answer the same shape of question. This used to read
      // "Unassigned: 7" with no Engineering row at all, because createTask leaves
      // task.department null unless a manager fills the field — so the table beside the
      // Teams report showed the same people under a real team and a null department.
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)

      const engineering = res.body.departmentReport.find(d => d.name === "Engineering")
      expect(engineering.total).toBe(7)
      expect(res.body.departmentReport.find(d => d.name === "Unassigned")).toBeUndefined()
    })

    it("lets an explicitly tagged task override the assignee's department", async () => {
      // The case task.department exists for: an engineer doing a piece of Finance work
      // is Finance's work, not Engineering's.
      const finance = await makeDepartment({ name: "Finance" })
      await makeTask({
        assignedTo: fixture.ana, assignedBy: fixture.manager,
        title: "Reconcile the ledger", department: finance
      })

      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)

      expect(res.body.departmentReport.find(d => d.name === "Finance").total).toBe(1)
      expect(res.body.departmentReport.find(d => d.name === "Engineering").total).toBe(7)
    })

    it("still reports Unassigned when neither the task nor the person has a department", async () => {
      // "Unassigned" now means genuinely unattributable, rather than "nobody filled in a
      // form field".
      const nomad = await makeUser({ role: "employee", manager: fixture.manager._id, department: null })
      await makeTask({ assignedTo: nomad, assignedBy: fixture.manager, title: "Floating work" })

      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)
      expect(res.body.departmentReport.find(d => d.name === "Unassigned").total).toBe(1)
    })

    it("counts overdue work under the same department of record", async () => {
      // The overdue tally is computed from a separate query; if it used a different rule
      // a department's overdue count would not match its own task list.
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)
      expect(res.body.departmentReport.find(d => d.name === "Engineering").overdue).toBe(1)
    })
  })

  describe("date filtering", () => {
    it("honours a YYYY-MM-DD range covering the whole end day", async () => {
      // A bare date parses as UTC midnight, so the end boundary is pushed with
      // setUTCHours — a local-time bump would silently drop same-day tasks on a server
      // running ahead of UTC.
      const res = await asUser(fixture.manager)
        .get("/api/tasks/report?startDate=2026-03-16&endDate=2026-03-16")
        .expect(200)

      // Everything in the fixture was created at the frozen clock, i.e. on the 16th.
      expect(rowFor(res, fixture.ana).total).toBe(7)
    })

    it("excludes tasks outside the range", async () => {
      const res = await asUser(fixture.manager)
        .get("/api/tasks/report?startDate=2026-01-01&endDate=2026-01-31")
        .expect(200)

      expect(rowFor(res, fixture.ana).total).toBe(0)
    })

    it("keeps overdue absolute even when the range excludes the task", async () => {
      const res = await asUser(fixture.manager)
        .get("/api/tasks/report?startDate=2026-01-01&endDate=2026-01-31")
        .expect(200)

      expect(rowFor(res, fixture.ana).overdue).toBe(1)
    })
  })

  describe("golden — the whole employee row", () => {
    it("matches the recorded shape and values", async () => {
      // Covers what the explicit assertions above cannot: a field added, removed or
      // renamed. Update deliberately with UPDATE_GOLDEN=1.
      const res = await asUser(fixture.manager).get("/api/tasks/report").expect(200)
      const ana = rowFor(res, fixture.ana)

      // `tasks` is the drill-down list; its own contents are asserted elsewhere and it
      // would dominate the diff.
      const { tasks, ...metrics } = ana
      expect(tasks.length).toBe(7)

      expectMatchesGolden(metrics, "report-employee-row.json")
    })

    it("matches the recorded org-wide summary", async () => {
      const res = await asUser(fixture.org.superAdmin).get("/api/tasks/report").expect(200)
      expectMatchesGolden(
        { healthReport: res.body.healthReport, priorityReport: res.body.priorityReport },
        "report-org-summary.json"
      )
    })
  })
})
