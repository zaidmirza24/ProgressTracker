import { describe, it, expect, vi } from "vitest"
import axios from "axios"
import { formatTrackedTime } from "../lib/taskFormatters"
import { renderWithProviders, screen } from "./renderWithProviders.jsx"
import { mockApi, httpError, networkError } from "./axiosMock.js"

vi.mock("axios", async () => (await import("./axiosMock.js")).axiosModuleFactory())

// Verifies the frontend harness: jsdom renders, the provider wrapper mounts, pure
// modules import, and the axios double covers the surface the app actually uses
// (methods, defaults, interceptors).
//
// Infrastructure verification only — the TimerContext rollback suite and the src/lib
// unit tests come next.

const Probe = () => <p>probe rendered</p>

describe("frontend test infrastructure", () => {
  it("imports and runs pure application modules", () => {
    expect(formatTrackedTime(3661)).toBe("1h 1m")
    expect(formatTrackedTime(0)).toBe("0m")
  })

  it("renders through the provider wrapper in jsdom", () => {
    renderWithProviders(<Probe />)
    expect(screen.getByText("probe rendered")).toBeDefined()
  })

  it("exposes the axios surface the app relies on", () => {
    // ToastContext installs a response interceptor and sets a default timeout;
    // AuthContext writes the Authorization header. Automock provides none of these.
    expect(axios.interceptors.response.use).toBeTypeOf("function")
    expect(axios.defaults.headers.common).toBeDefined()
  })

  it("routes mocked requests and records them", async () => {
    const api = mockApi(axios, { "GET /api/tasks": { tasks: [{ _id: "t1" }] } })

    const res = await axios.get("http://localhost:3000/api/tasks?scope=today")

    expect(res.data.tasks).toHaveLength(1)
    expect(api.callsTo("get", "/api/tasks")).toHaveLength(1)
  })

  it("reproduces axios error shapes, including the no-response case", async () => {
    mockApi(axios, {
      "GET /api/tasks": httpError(403, { error: "Forbidden", code: "FORBIDDEN" }),
      "GET /api/health": networkError()
    })

    await expect(axios.get("/api/tasks")).rejects.toMatchObject({
      response: { status: 403, data: { code: "FORBIDDEN" } }
    })
    // `request` set but no `response` — the branch ToastContext reports as a network error.
    await expect(axios.get("/api/health")).rejects.toMatchObject({ request: {} })
  })

  it("fails loudly on an unrouted request instead of resolving undefined", async () => {
    mockApi(axios, {})
    await expect(axios.get("/api/unrouted")).rejects.toMatchObject({ response: { status: 501 } })
  })
})
