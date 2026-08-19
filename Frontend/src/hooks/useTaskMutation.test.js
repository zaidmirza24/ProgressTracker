import { describe, it, expect, vi, beforeEach } from "vitest"
import axios from "axios"
import { useTaskMutation } from "./useTaskMutation"
import { useTaskStatusMutation } from "./useTaskStatusMutation"
import { mockApi, httpError } from "../tests/axiosMock"

vi.mock("axios", async () => (await import("../tests/axiosMock.js")).axiosModuleFactory())

// The optimistic-mutation hooks: patch the local task array immediately, reconcile with
// the server's response, roll back on failure.
//
// Rollback is the part worth testing hardest. When it fails, the user sees a change
// that did not happen — a task showing "Completed" that the server rejected, or a
// cancelled task that is still there on the next refresh. The capacity bars, Attention
// Zone counts and 7-day forecast are all derived from this same array, so a bad patch
// propagates into numbers a manager acts on.
//
// Driven directly rather than through a component: these are plain functions over a
// state setter, so a tiny fake store exercises them honestly without mounting a tree.

const TASK = { _id: "t1", title: "Original", status: "Not Started", updatedAt: "2026-03-16T10:00:00.000Z" }
const OTHER = { _id: "t2", title: "Untouched", status: "In Progress" }

// Mirrors what zustand's setTasks does: accepts a value or an updater.
const makeStore = (initialTasks, initialDetail = null) => {
  const store = {
    tasks: initialTasks,
    detailTask: initialDetail,
    submitting: [],
    setTasks: (updater) => {
      store.tasks = typeof updater === "function" ? updater(store.tasks) : updater
    },
    setDetailTask: (updater) => {
      store.detailTask = typeof updater === "function" ? updater(store.detailTask) : updater
    },
    setSubmitting: (value) => store.submitting.push(value)
  }
  return store
}

const hookArgs = (store, extra = {}) => ({
  tasks: store.tasks,
  setTasks: store.setTasks,
  detailTask: store.detailTask,
  setDetailTask: store.setDetailTask,
  setSubmitting: store.setSubmitting,
  ...extra
})

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("patchTask", () => {
  it("applies the change locally before the request resolves", async () => {
    const store = makeStore([TASK, OTHER])
    let seenDuringRequest
    mockApi(axios, {
      "PATCH /api/tasks/t1": () => {
        seenDuringRequest = store.tasks.find(t => t._id === "t1").title
        return { task: { ...TASK, title: "Renamed", updatedAt: "2026-03-16T11:00:00.000Z" } }
      }
    })

    const { patchTask } = useTaskMutation(hookArgs(store))
    await patchTask("t1", { title: "Renamed" })

    // The whole point of optimistic UI: the change was visible while the call was in flight.
    expect(seenDuringRequest).toBe("Renamed")
  })

  it("reconciles with the server's version of the task", async () => {
    const store = makeStore([TASK, OTHER])
    const serverTask = { ...TASK, title: "Renamed", totalTrackedSeconds: 3600, isOverrun: true }
    mockApi(axios, { "PATCH /api/tasks/t1": { task: serverTask } })

    const { patchTask } = useTaskMutation(hookArgs(store))
    const result = await patchTask("t1", { title: "Renamed" })

    // Server-computed fields the client could not know are now present.
    expect(store.tasks[0]).toEqual(serverTask)
    expect(result).toMatchObject({ success: true, task: serverTask })
  })

  it("leaves other tasks alone", async () => {
    const store = makeStore([TASK, OTHER])
    mockApi(axios, { "PATCH /api/tasks/t1": { task: { ...TASK, title: "Renamed" } } })

    await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "Renamed" })
    expect(store.tasks[1]).toBe(OTHER)
  })

  it("rolls the array back completely when the request fails", async () => {
    const store = makeStore([TASK, OTHER])
    mockApi(axios, { "PATCH /api/tasks/t1": httpError(403, { code: "FORBIDDEN" }) })

    const result = await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "Renamed" })

    expect(store.tasks).toEqual([TASK, OTHER])
    expect(result).toEqual({ success: false, code: "FORBIDDEN" })
  })

  it("returns the machine-readable code so callers can branch on a conflict", async () => {
    // TASK_MODIFIED needs different handling from a generic failure — the user must be
    // told to reload rather than simply retry.
    const store = makeStore([TASK])
    mockApi(axios, { "PATCH /api/tasks/t1": httpError(409, { code: "TASK_MODIFIED" }) })

    const result = await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "X" })
    expect(result.code).toBe("TASK_MODIFIED")
  })

  it("sends the loaded version so the server can reject a stale write", async () => {
    const store = makeStore([TASK])
    const api = mockApi(axios, { "PATCH /api/tasks/t1": { task: TASK } })

    await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "X" })

    expect(api.callsTo("patch", "/api/tasks/t1")[0].args[0]).toMatchObject({
      title: "X",
      updatedAt: TASK.updatedAt
    })
  })

  it("prefers the display-shaped optimistic override when one is given", async () => {
    // Reassignment sends a raw id but must patch a populated ref locally, or every
    // `assignedTo.name` render breaks until the response lands.
    const store = makeStore([{ ...TASK, assignedTo: { _id: "u1", name: "Ana" } }])
    let nameDuringRequest
    mockApi(axios, {
      "PATCH /api/tasks/t1": () => {
        nameDuringRequest = store.tasks[0].assignedTo.name
        return { task: TASK }
      }
    })

    await useTaskMutation(hookArgs(store)).patchTask(
      "t1",
      { assignedTo: "u2" },
      { optimistic: { assignedTo: { _id: "u2", name: "Ade" } } }
    )

    expect(nameDuringRequest).toBe("Ade")
  })

  it("keeps the open detail dialog in step with the list", async () => {
    const store = makeStore([TASK], TASK)
    const serverTask = { ...TASK, title: "Renamed" }
    mockApi(axios, { "PATCH /api/tasks/t1": { task: serverTask } })

    await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "Renamed" })
    expect(store.detailTask).toEqual(serverTask)
  })

  it("restores the detail dialog on failure too", async () => {
    const store = makeStore([TASK], TASK)
    mockApi(axios, { "PATCH /api/tasks/t1": httpError(500) })

    await useTaskMutation(hookArgs(store)).patchTask("t1", { title: "Renamed" })
    expect(store.detailTask).toEqual(TASK)
  })

  it("always clears the submitting flag, on success and on failure", async () => {
    // A stuck spinner is indistinguishable from a hung app.
    const ok = makeStore([TASK])
    mockApi(axios, { "PATCH /api/tasks/t1": { task: TASK } })
    await useTaskMutation(hookArgs(ok)).patchTask("t1", { title: "X" })
    expect(ok.submitting).toEqual([true, false])

    const bad = makeStore([TASK])
    mockApi(axios, { "PATCH /api/tasks/t1": httpError(500) })
    await useTaskMutation(hookArgs(bad)).patchTask("t1", { title: "X" })
    expect(bad.submitting).toEqual([true, false])
  })

  it("surfaces a capacity warning without treating it as a failure", async () => {
    const store = makeStore([TASK])
    mockApi(axios, { "PATCH /api/tasks/t1": { task: TASK, warning: "Ana is over capacity that day" } })

    const result = await useTaskMutation(hookArgs(store)).patchTask("t1", { estimatedHours: 40 })
    expect(result.success).toBe(true)
    expect(result.warning).toMatch(/over capacity/i)
  })
})

describe("cancelTask", () => {
  it("removes the task from the list immediately", async () => {
    const store = makeStore([TASK, OTHER])
    let seenDuringRequest
    mockApi(axios, {
      "DELETE /api/tasks/t1": () => {
        seenDuringRequest = store.tasks.map(t => t._id)
        return { success: true }
      }
    })

    await useTaskMutation(hookArgs(store)).cancelTask("t1", "No longer needed")
    expect(seenDuringRequest).toEqual(["t2"])
    expect(store.tasks).toEqual([OTHER])
  })

  it("sends the reason in the request body", async () => {
    const store = makeStore([TASK])
    const api = mockApi(axios, { "DELETE /api/tasks/t1": { success: true } })

    await useTaskMutation(hookArgs(store)).cancelTask("t1", "Duplicate")
    expect(api.callsTo("delete", "/api/tasks/t1")[0].args[0]).toEqual({ data: { reason: "Duplicate" } })
  })

  it("puts the task back when the server refuses", async () => {
    // Completed work cannot be cancelled — the row must reappear, not vanish.
    const store = makeStore([TASK, OTHER])
    mockApi(axios, { "DELETE /api/tasks/t1": httpError(409, { code: "TASK_LOCKED" }) })

    const result = await useTaskMutation(hookArgs(store)).cancelTask("t1", "nope")

    expect(store.tasks).toEqual([TASK, OTHER])
    expect(result.code).toBe("TASK_LOCKED")
  })

  it("closes the detail dialog for the cancelled task, and reopens it on failure", async () => {
    const store = makeStore([TASK], TASK)
    mockApi(axios, { "DELETE /api/tasks/t1": httpError(403) })

    await useTaskMutation(hookArgs(store)).cancelTask("t1", "nope")
    expect(store.detailTask).toEqual(TASK)
  })
})

describe("setBlocked", () => {
  it("shows the blocked state and reason immediately", async () => {
    const store = makeStore([TASK])
    let duringRequest
    mockApi(axios, {
      "PATCH /api/tasks/t1/blocked": () => {
        duringRequest = { ...store.tasks[0] }
        return { task: { ...TASK, isBlocked: true, blockedReason: "Waiting on design" } }
      }
    })

    await useTaskMutation(hookArgs(store)).setBlocked("t1", true, "Waiting on design")

    expect(duringRequest.isBlocked).toBe(true)
    expect(duringRequest.blockedReason).toBe("Waiting on design")
    expect(duringRequest.blockedAt).toBeTruthy()
  })

  it("clears the reason and timestamp when unblocking", async () => {
    const blocked = { ...TASK, isBlocked: true, blockedReason: "stuck", blockedAt: "2026-03-16T09:00:00.000Z" }
    const store = makeStore([blocked])
    let duringRequest
    mockApi(axios, {
      "PATCH /api/tasks/t1/blocked": () => {
        duringRequest = { ...store.tasks[0] }
        return { task: { ...TASK, isBlocked: false } }
      }
    })

    await useTaskMutation(hookArgs(store)).setBlocked("t1", false)

    expect(duringRequest.isBlocked).toBe(false)
    expect(duringRequest.blockedReason).toBe("")
    expect(duringRequest.blockedAt).toBeNull()
  })

  it("rolls back a rejected block", async () => {
    const store = makeStore([TASK])
    mockApi(axios, { "PATCH /api/tasks/t1/blocked": httpError(409, { code: "ALREADY_BLOCKED" }) })

    const result = await useTaskMutation(hookArgs(store)).setBlocked("t1", true, "stuck")

    expect(store.tasks).toEqual([TASK])
    expect(result.code).toBe("ALREADY_BLOCKED")
  })
})

describe("useTaskStatusMutation", () => {
  it("shows the new status and its progress percentage immediately", async () => {
    const store = makeStore([TASK])
    let duringRequest
    mockApi(axios, {
      "PUT /api/tasks/t1/status": () => {
        duringRequest = { ...store.tasks[0] }
        return { task: { ...TASK, status: "In Progress", progressPercentage: 50 } }
      }
    })

    await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "In Progress")

    expect(duringRequest.status).toBe("In Progress")
    expect(duringRequest.progressPercentage).toBe(50)
  })

  it("sends the status, the comment and the loaded version", async () => {
    const store = makeStore([TASK])
    const api = mockApi(axios, { "PUT /api/tasks/t1/status": { task: TASK } })

    await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "In Progress", "Starting now")

    expect(api.callsTo("put", "/api/tasks/t1/status")[0].args[0]).toEqual({
      status: "In Progress",
      comment: "Starting now",
      updatedAt: TASK.updatedAt
    })
  })

  it("rolls back a rejected transition", async () => {
    // The server enforces the workflow; a refused transition must not linger on screen.
    const store = makeStore([TASK])
    mockApi(axios, { "PUT /api/tasks/t1/status": httpError(400, { error: "Forbidden status transition" }) })

    const result = await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "Completed")

    expect(store.tasks).toEqual([TASK])
    expect(result.success).toBe(false)
  })

  it("runs the caller's side effect only after a successful change", async () => {
    // The employee dashboard uses this to refresh the timer when the changed task is
    // the one being tracked.
    const onSuccess = vi.fn()
    const store = makeStore([TASK])
    mockApi(axios, { "PUT /api/tasks/t1/status": { task: { ...TASK, status: "In Progress" } } })

    await useTaskStatusMutation(hookArgs(store, { onSuccess })).updateStatus("t1", "In Progress")
    expect(onSuccess).toHaveBeenCalledWith("t1", expect.objectContaining({ status: "In Progress" }))

    onSuccess.mockClear()
    mockApi(axios, { "PUT /api/tasks/t1/status": httpError(400) })
    await useTaskStatusMutation(hookArgs(store, { onSuccess })).updateStatus("t1", "Completed")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("leaves an open detail dialog alone when a DIFFERENT task changes", async () => {
    const openTask = { ...OTHER }
    const store = makeStore([TASK, OTHER], openTask)
    mockApi(axios, { "PUT /api/tasks/t1/status": { task: { ...TASK, status: "In Progress" } } })

    await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "In Progress")
    expect(store.detailTask).toBe(openTask)
  })

  it("reports no code when the request never reached the server", async () => {
    // A network failure has no response body to read a code from — the caller must get
    // `undefined` rather than a crash on the optional chain.
    const store = makeStore([TASK])
    const networkFailure = Object.assign(new Error("Network Error"), { request: {} })
    mockApi(axios, { "PUT /api/tasks/t1/status": networkFailure })

    const result = await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "In Progress")

    expect(result).toEqual({ success: false, code: undefined })
    expect(store.tasks).toEqual([TASK])
  })

  it("still works when the task is not in the local array", async () => {
    // The detail dialog can outlive a filtered list, so `current` may be undefined and
    // no version is sent.
    const store = makeStore([OTHER])
    const api = mockApi(axios, { "PUT /api/tasks/t1/status": { task: TASK } })

    await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "In Progress")
    expect(api.callsTo("put", "/api/tasks/t1/status")[0].args[0].updatedAt).toBeUndefined()
  })

  it("falls back to the task's current progress for an unmapped status", async () => {
    const store = makeStore([{ ...TASK, progressPercentage: 42 }])
    let duringRequest
    mockApi(axios, {
      "PUT /api/tasks/t1/status": () => {
        duringRequest = { ...store.tasks[0] }
        return { task: TASK }
      }
    })

    await useTaskStatusMutation(hookArgs(store)).updateStatus("t1", "Nonsense")
    expect(duringRequest.progressPercentage).toBe(42)
  })
})
