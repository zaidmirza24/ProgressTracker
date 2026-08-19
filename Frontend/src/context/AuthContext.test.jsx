import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import axios from "axios"
import { AuthProvider, useAuth } from "./AuthContext"
import { mockApi, httpError } from "../tests/axiosMock"

vi.mock("axios", async () => (await import("../tests/axiosMock.js")).axiosModuleFactory())

// Session handling. Written BEFORE changing this file, so the cascading-render fix that
// follows is measured against behaviour rather than intention.
//
// The behaviour that matters most is the `loading` gate: ProtectedRoute renders a spinner
// while it is true, so getting it wrong either flashes the login page at a signed-in user
// on every refresh, or leaves the app stuck verifying forever.

const USER = { _id: "u1", name: "Ana Employee", role: "employee" }

const render = () => renderHook(() => useAuth(), { wrapper: AuthProvider })

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {})
  localStorage.clear()
})

describe("with no stored token", () => {
  it("settles immediately as signed out, without asking the server", async () => {
    mockApi(axios, {})
    const { result } = render()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(axios.get).not.toHaveBeenCalled()
  })

  it("clears any stale Authorization header", async () => {
    axios.defaults.headers.common["Authorization"] = "Bearer leftover"
    mockApi(axios, {})
    const { result } = render()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(axios.defaults.headers.common["Authorization"]).toBeUndefined()
  })
})

describe("with a stored token", () => {
  beforeEach(() => localStorage.setItem("token", "stored-token"))

  it("holds `loading` until the server has verified the session", async () => {
    // ProtectedRoute shows a spinner while this is true. Settling early would redirect a
    // valid user to the login page on every refresh.
    let resolveMe
    mockApi(axios, { "GET /api/auth/me": () => new Promise(res => { resolveMe = res }) })

    const { result } = render()
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()

    await act(async () => { resolveMe({ user: USER }) })

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toEqual(USER)
  })

  it("sends the token on the verification request and leaves it set", async () => {
    mockApi(axios, { "GET /api/auth/me": { user: USER } })
    const { result } = render()

    await waitFor(() => expect(result.current.user).toEqual(USER))
    expect(axios.defaults.headers.common["Authorization"]).toBe("Bearer stored-token")
  })

  it("signs out when the stored token is no longer accepted", async () => {
    // A deactivated account or an expired token: the server 401s and the client must not
    // keep pretending to be signed in.
    mockApi(axios, { "GET /api/auth/me": httpError(401, { error: "Invalid or expired token" }) })
    const { result } = render()

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem("token")).toBeNull()
  })
})

describe("logging in", () => {
  it("stores the token and the user, and reports success", async () => {
    // Setting the token re-runs the verification effect, so /me must be routed too —
    // a successful login still round-trips before the session is considered good.
    mockApi(axios, {
      "POST /api/auth/login": { token: "fresh-token", user: USER },
      "GET /api/auth/me": { user: USER }
    })
    const { result } = render()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => { outcome = await result.current.login("ana@test.local", "password123") })

    expect(outcome).toEqual({ success: true })
    expect(result.current.user).toEqual(USER)
    expect(localStorage.getItem("token")).toBe("fresh-token")
  })

  it("signs the user back out if the new token fails verification", async () => {
    // Documents a real consequence of the token effect: login succeeding is not enough,
    // the follow-up /me call has the final say.
    mockApi(axios, {
      "POST /api/auth/login": { token: "fresh-token", user: USER },
      "GET /api/auth/me": httpError(401, { error: "Invalid or expired token" })
    })
    const { result } = render()
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.login("ana@test.local", "password123") })

    await waitFor(() => expect(result.current.user).toBeNull())
    expect(localStorage.getItem("token")).toBeNull()
  })

  it("returns the server's message on a bad password rather than a generic one", async () => {
    mockApi(axios, { "POST /api/auth/login": httpError(401, { error: "Invalid email or password" }) })
    const { result } = render()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => { outcome = await result.current.login("ana@test.local", "wrong") })

    expect(outcome.success).toBe(false)
    expect(outcome.error).toBe("Invalid email or password")
    expect(result.current.user).toBeNull()
  })

  it("surfaces the rate-limiter message", async () => {
    mockApi(axios, {
      "POST /api/auth/login": httpError(429, { message: "Too many login attempts. Please try again in a few minutes." })
    })
    const { result } = render()
    await waitFor(() => expect(result.current.loading).toBe(false))

    let outcome
    await act(async () => { outcome = await result.current.login("ana@test.local", "x") })
    expect(outcome.error).toMatch(/too many/i)
  })
})

describe("logging out", () => {
  it("clears the user, the token and the header", async () => {
    localStorage.setItem("token", "stored-token")
    mockApi(axios, { "GET /api/auth/me": { user: USER } })
    const { result } = render()
    await waitFor(() => expect(result.current.user).toEqual(USER))

    await act(async () => { result.current.logout() })

    expect(result.current.user).toBeNull()
    expect(localStorage.getItem("token")).toBeNull()
    expect(axios.defaults.headers.common["Authorization"]).toBeUndefined()
  })
})

describe("useAuth outside a provider", () => {
  it("fails loudly rather than returning undefined", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/must be used within an AuthProvider/)
  })
})
