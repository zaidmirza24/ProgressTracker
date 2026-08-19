import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import axios from "axios"
import { TimerProvider, useTimer } from "./TimerContext"
import AuthContext from "./AuthContext"
import { mockApi, httpError } from "../tests/axiosMock"

vi.mock("axios", async () => (await import("../tests/axiosMock.js")).axiosModuleFactory())

// TimerContext is the highest-risk code on the client: it drives the clock the employee
// watches, and every action is optimistic — the UI commits to a change before the server
// has agreed to it.
//
// Two failure modes matter. A missing ROLLBACK leaves a timer that appears to be running
// when the server refused it, so the employee believes time is being recorded that is
// not. A missing RECONCILE leaves the client's guess in place instead of the server's
// authoritative elapsed seconds, and client-side time is exactly what Core Rule 1 says
// must never be trusted.
//
// AuthProvider is bypassed with a plain context value: the real one fetches
// /api/auth/me on mount, which would make every test here depend on an unrelated route.

const USER = { id: "u1", name: "Ana Employee", role: "employee" }

const SERVER_SESSION = {
  _id: "s1",
  task: { _id: "t1", title: "Payment reconciliation", category: "General" },
  employee: "u1",
  startedAt: "2026-03-16T09:00:00.000Z",
  events: [],
  stoppedAt: null,
  totalSeconds: 0
}

const wrapperFor = (user = USER) => ({ children }) => (
  <AuthContext.Provider value={{ user, token: "t", loading: false, login: vi.fn(), logout: vi.fn() }}>
    <TimerProvider>{children}</TimerProvider>
  </AuthContext.Provider>
)

/** Mount the hook and wait for its initial /active fetch to settle. */
const renderTimer = async ({ user = USER } = {}) => {
  const view = renderHook(() => useTimer(), { wrapper: wrapperFor(user) })
  await waitFor(() => expect(axios.get).toHaveBeenCalled())
  return view
}

const idleRoutes = { "GET /api/work-sessions/active": { session: null, elapsedSeconds: 0, isRunning: false } }
const runningRoutes = {
  "GET /api/work-sessions/active": { session: SERVER_SESSION, elapsedSeconds: 125, isRunning: true }
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
})

describe("rehydrating on mount", () => {
  it("adopts a session that is already running on the server", async () => {
    // Survives a page refresh: the clock resumes from the server's elapsed count, not
    // from zero.
    mockApi(axios, runningRoutes)
    const { result } = await renderTimer()

    await waitFor(() => expect(result.current.isRunning).toBe(true))
    expect(result.current.elapsedSeconds).toBe(125)
    expect(result.current.activeSession.task.title).toBe("Payment reconciliation")
  })

  it("stays idle when nothing is running", async () => {
    mockApi(axios, idleRoutes)
    const { result } = await renderTimer()

    await waitFor(() => expect(result.current.activeSession).toBeNull())
    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it("does not fetch a session when nobody is signed in", async () => {
    mockApi(axios, idleRoutes)
    renderHook(() => useTimer(), { wrapper: wrapperFor(null) })

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(axios.get).not.toHaveBeenCalled()
  })

  it("leaves the timer idle when the fetch fails, rather than breaking the page", async () => {
    mockApi(axios, { "GET /api/work-sessions/active": httpError(500) })
    const { result } = await renderTimer()

    await waitFor(() => expect(result.current.isRunning).toBe(false))
    expect(result.current.activeSession).toBeNull()
  })
})

describe("starting a timer", () => {
  it("starts ticking immediately, before the server responds", async () => {
    mockApi(axios, idleRoutes)
    const { result } = await renderTimer()

    let resolveStart
    mockApi(axios, {
      ...idleRoutes,
      "POST /api/work-sessions/start": () => new Promise(res => { resolveStart = res })
    })

    let pending
    await act(async () => { pending = result.current.startTimer("t1") })

    // The optimistic commit: running, with a placeholder session, while in flight.
    expect(result.current.isRunning).toBe(true)
    expect(result.current.isPending).toBe(true)
    expect(result.current.activeSession._id).toBe("__optimistic__")

    await act(async () => {
      resolveStart({ session: SERVER_SESSION, elapsedSeconds: 0, isRunning: true })
      await pending
    })

    // ...replaced by the server's real session once it lands.
    expect(result.current.activeSession._id).toBe("s1")
    expect(result.current.isPending).toBe(false)
  })

  it("reconciles elapsed seconds with the server rather than keeping its own count", async () => {
    // Core Rule 1 — client timestamps are never trusted.
    mockApi(axios, {
      ...idleRoutes,
      "POST /api/work-sessions/start": { session: SERVER_SESSION, elapsedSeconds: 42, isRunning: true }
    })
    const { result } = await renderTimer()

    await act(async () => { await result.current.startTimer("t1") })
    expect(result.current.elapsedSeconds).toBe(42)
  })

  it("rolls back to idle when the server refuses", async () => {
    // Starting a timer on someone else's task is a 403. The clock must not be left
    // running, or the employee believes time is being recorded that is not.
    mockApi(axios, {
      ...idleRoutes,
      "POST /api/work-sessions/start": httpError(403, { error: "You do not have permission to track time on this task" })
    })
    const { result } = await renderTimer()

    let outcome
    await act(async () => { outcome = await result.current.startTimer("t1") })

    expect(outcome.success).toBe(false)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.activeSession).toBeNull()
    expect(result.current.isPending).toBe(false)
  })

  it("restores the PREVIOUS session when switching tasks fails", async () => {
    // The subtle case: the employee was already tracking something. A failed switch
    // must put the original session back, not clear the timer entirely.
    mockApi(axios, runningRoutes)
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/start": httpError(500) })
    await act(async () => { await result.current.startTimer("t2") })

    expect(result.current.activeSession._id).toBe("s1")
    expect(result.current.elapsedSeconds).toBe(125)
    expect(result.current.isRunning).toBe(true)
  })
})

describe("pausing", () => {
  it("stops the clock immediately and then takes the server's total", async () => {
    mockApi(axios, runningRoutes)
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    mockApi(axios, {
      ...runningRoutes,
      "POST /api/work-sessions/pause": {
        session: { ...SERVER_SESSION, totalSeconds: 130, events: [{ type: "pause" }] },
        elapsedSeconds: 130,
        isRunning: false
      }
    })

    await act(async () => { await result.current.pauseTimer() })

    expect(result.current.isRunning).toBe(false)
    expect(result.current.elapsedSeconds).toBe(130)
  })

  it("resumes ticking again if the pause request fails", async () => {
    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/pause": httpError(500) })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => { await result.current.pauseTimer() })

    expect(result.current.isRunning).toBe(true)
    expect(result.current.elapsedSeconds).toBe(125)
  })

  it("clears the timer when the server says there is no session", async () => {
    // A 404 means the client's view is stale — another tab already stopped it. Rolling
    // back would restore a session that no longer exists.
    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/pause": httpError(404) })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => { await result.current.pauseTimer() })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })
})

describe("resuming", () => {
  it("starts ticking immediately and reconciles", async () => {
    mockApi(axios, {
      "GET /api/work-sessions/active": {
        session: { ...SERVER_SESSION, events: [{ type: "pause" }], totalSeconds: 130 },
        elapsedSeconds: 130,
        isRunning: false
      },
      "POST /api/work-sessions/resume": { session: SERVER_SESSION, elapsedSeconds: 130, isRunning: true }
    })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.activeSession).not.toBeNull())

    await act(async () => { await result.current.resumeTimer() })
    expect(result.current.isRunning).toBe(true)
  })

  it("goes back to paused if the resume fails", async () => {
    mockApi(axios, {
      "GET /api/work-sessions/active": {
        session: { ...SERVER_SESSION, events: [{ type: "pause" }] },
        elapsedSeconds: 130,
        isRunning: false
      },
      "POST /api/work-sessions/resume": httpError(500)
    })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.activeSession).not.toBeNull())

    await act(async () => { await result.current.resumeTimer() })
    expect(result.current.isRunning).toBe(false)
  })
})

describe("stopping", () => {
  it("clears the timer immediately", async () => {
    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/stop": { success: true } })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => { await result.current.stopTimer() })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.isRunning).toBe(false)
  })

  it("puts the session back if stopping fails, so the time is not abandoned", async () => {
    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/stop": httpError(500) })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => { await result.current.stopTimer() })

    expect(result.current.activeSession._id).toBe("s1")
    expect(result.current.elapsedSeconds).toBe(125)
    expect(result.current.isRunning).toBe(true)
  })

  it("stays cleared when the session was already gone", async () => {
    mockApi(axios, { ...runningRoutes, "POST /api/work-sessions/stop": httpError(404) })
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    await act(async () => { await result.current.stopTimer() })
    expect(result.current.activeSession).toBeNull()
  })
})

describe("the ticking clock", () => {
  // Fake timers must be installed BEFORE the provider mounts. The tick is a setInterval
  // created inside an effect; enabling fake timers afterwards leaves that already-live
  // real interval outside Vitest's control, and advanceTimersByTime does nothing to it.
  const mountWithFakeTimers = async () => {
    vi.useFakeTimers()
    const view = renderHook(() => useTimer(), { wrapper: wrapperFor() })
    // Flush the mount effect's fetch. `act` drains microtasks, which is what the
    // resolved axios promise needs — no timer has to fire for this.
    await act(async () => {})
    return view
  }

  it("advances once per second while running", async () => {
    mockApi(axios, runningRoutes)
    const { result } = await mountWithFakeTimers()
    expect(result.current.isRunning).toBe(true)

    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(result.current.elapsedSeconds).toBe(128)
  })

  it("freezes once paused, so a paused timer cannot inflate the hours", async () => {
    mockApi(axios, {
      ...runningRoutes,
      "POST /api/work-sessions/pause": { session: SERVER_SESSION, elapsedSeconds: 125, isRunning: false }
    })
    const { result } = await mountWithFakeTimers()

    await act(async () => { await result.current.pauseTimer() })
    expect(result.current.isRunning).toBe(false)

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(result.current.elapsedSeconds).toBe(125)
  })

  it("does not tick while idle", async () => {
    mockApi(axios, idleRoutes)
    const { result } = await mountWithFakeTimers()

    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(result.current.elapsedSeconds).toBe(0)
  })

  it("clears its interval on unmount", async () => {
    // A leaked interval keeps firing state updates into a torn-down tree.
    mockApi(axios, runningRoutes)
    const { unmount } = await mountWithFakeTimers()

    const clearSpy = vi.spyOn(globalThis, "clearInterval")
    unmount()
    expect(clearSpy).toHaveBeenCalled()
  })
})

describe("refreshTimer", () => {
  it("re-reads the server's state on demand", async () => {
    // Used after a status transition that may have stopped the timer server-side.
    mockApi(axios, runningRoutes)
    const { result } = await renderTimer()
    await waitFor(() => expect(result.current.isRunning).toBe(true))

    mockApi(axios, idleRoutes)
    await act(async () => { await result.current.refreshTimer() })

    expect(result.current.activeSession).toBeNull()
    expect(result.current.isRunning).toBe(false)
  })
})

describe("useTimer outside a provider", () => {
  it("fails loudly rather than returning undefined", async () => {
    expect(() => renderHook(() => useTimer())).toThrow(/must be used within a TimerProvider/)
  })
})
