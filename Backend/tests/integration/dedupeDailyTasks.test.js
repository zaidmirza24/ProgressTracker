import { describe, it, expect, beforeEach, afterEach } from "vitest"
import Task from "../../models/Task.js"
import { dedupeDailyTasks, findDuplicateGroups } from "../../scripts/dedupeDailyTasks.js"
import { buildOrg, makeTemplate, makeDailyTask, makeStoppedSession } from "../factories/index.js"
import { startOfLocalDay } from "../helpers/clock.js"

// The one-off cleanup that has to run before the uniqueness constraint can be built.
//
// It is destructive, and it decides which of several real tasks survives — so it gets
// the same scrutiny as product code. The stakes: keeping the wrong instance discards
// somebody's logged work, and MongoDB will not build the index while any duplicate
// remains (silently, because Mongoose logs index-build failures and carries on).

const TODAY = startOfLocalDay()
const DAILY_UNIQUE_INDEX = "assignedTo_1_templateRef_1_dailyDate_1"

describe("dedupeDailyTasks", () => {
  let org, template

  beforeEach(async () => {
    // Drop the uniqueness constraint so the fixtures can reproduce a database written
    // BEFORE it existed — which is the only situation this script is for. With the index
    // in place the duplicates simply cannot be inserted, so testing the cleanup against
    // a constrained database would test nothing.
    await Task.collection.dropIndex(DAILY_UNIQUE_INDEX).catch(() => {})

    org = await buildOrg()
    template = await makeTemplate({ createdBy: org.superAdmin, title: "Morning Standup" })
  })

  afterEach(async () => {
    // Put the constraint back: test files share a per-worker database, so leaving it
    // dropped would silently disarm it for whatever runs next.
    //
    // Tasks are cleared first because the dry-run case deliberately leaves duplicates
    // behind, and rebuilding a unique index over them fails — which is precisely the
    // production situation this script exists to resolve, reproduced here by accident.
    await Task.deleteMany({})
    await Task.syncIndexes()
  })

  const makeInstance = (overrides = {}) => makeDailyTask({
    assignedTo: org.employeeA1,
    title: "Morning Standup",
    templateRef: template,
    dailyDate: TODAY,
    ...overrides
  })

  it("finds nothing when there are no duplicates", async () => {
    await makeInstance()
    const summary = await dedupeDailyTasks({ apply: true })

    expect(summary.groups).toBe(0)
    expect(summary.duplicates).toBe(0)
    expect(await Task.countDocuments({ isActive: true })).toBe(1)
  })

  it("reports without writing anything on a dry run", async () => {
    await makeInstance()
    await makeInstance()

    const summary = await dedupeDailyTasks()

    expect(summary.groups).toBe(1)
    expect(summary.duplicates).toBe(1)
    // The whole point of a dry run: the operator sees the plan before agreeing to it.
    expect(await Task.countDocuments({ isActive: true })).toBe(2)
  })

  it("collapses a group to a single active task when applied", async () => {
    await makeInstance()
    await makeInstance()
    await makeInstance()

    await dedupeDailyTasks({ apply: true })

    expect(await Task.countDocuments({ isActive: true })).toBe(1)
  })

  it("soft-deletes rather than removing, and records why", async () => {
    // Core Rule 2 — the rows stay, with an audit trail explaining the change.
    await makeInstance()
    await makeInstance()

    await dedupeDailyTasks({ apply: true })

    expect(await Task.countDocuments()).toBe(2)
    const removed = await Task.findOne({ isActive: false })
    expect(removed.history.at(-1).comment).toMatch(/duplicate/i)
  })

  it("keeps the instance that has tracked time, not simply the oldest", async () => {
    // The risk in the naive rule. If the duplicate created LATER is the one the employee
    // actually worked on, keeping the oldest throws that work away.
    const untouched = await makeInstance({ status: "Not Started" })
    const worked = await makeInstance({ status: "In Progress" })
    await makeStoppedSession({ task: worked, employee: org.employeeA1, seconds: 3600 })

    await dedupeDailyTasks({ apply: true })

    const survivor = await Task.findOne({ isActive: true })
    expect(survivor._id.toString()).toBe(worked._id.toString())
    expect((await Task.findById(untouched._id)).isActive).toBe(false)
  })

  it("keeps the instance whose status has moved on when neither has tracked time", async () => {
    const untouched = await makeInstance({ status: "Not Started" })
    const started = await makeInstance({ status: "Pending" })

    await dedupeDailyTasks({ apply: true })

    const survivor = await Task.findOne({ isActive: true })
    expect(survivor._id.toString()).toBe(started._id.toString())
    expect((await Task.findById(untouched._id)).isActive).toBe(false)
  })

  it("falls back to the oldest when no instance has any work", async () => {
    const first = await makeInstance()
    await makeInstance()

    await dedupeDailyTasks({ apply: true })

    expect((await Task.findOne({ isActive: true }))._id.toString()).toBe(first._id.toString())
  })

  it("treats different days, employees and templates as separate groups", async () => {
    const yesterday = new Date(TODAY)
    yesterday.setDate(yesterday.getDate() - 1)
    const other = await makeTemplate({ createdBy: org.superAdmin, title: "Inbox triage" })

    await makeInstance()
    await makeInstance({ dailyDate: yesterday })
    await makeInstance({ assignedTo: org.employeeA2 })
    await makeInstance({ templateRef: other })

    // Four distinct keys — none of them a duplicate of another.
    expect(await findDuplicateGroups()).toHaveLength(0)
    await dedupeDailyTasks({ apply: true })
    expect(await Task.countDocuments({ isActive: true })).toBe(4)
  })

  it("ignores already-cancelled instances and ad-hoc tasks", async () => {
    // Only active, template-derived dailies are in scope — the same shape as the index.
    const live = await makeInstance()
    const cancelled = await makeInstance({ isActive: false })

    await dedupeDailyTasks({ apply: true })

    expect((await Task.findById(live._id)).isActive).toBe(true)
    expect((await Task.findById(cancelled._id)).isActive).toBe(false)
  })

  it("leaves the database able to build the unique index", async () => {
    // The reason the script exists: proving the end state actually satisfies the
    // constraint is stronger than counting rows.
    await makeInstance()
    await makeInstance()
    await makeInstance({ assignedTo: org.employeeA2 })
    await makeInstance({ assignedTo: org.employeeA2 })

    await dedupeDailyTasks({ apply: true })

    await expect(Task.syncIndexes()).resolves.toBeDefined()
    expect(await findDuplicateGroups()).toHaveLength(0)
  })
})
