import { vi } from "vitest"

// Axios test double.
//
// The app calls axios directly from contexts, hooks and stores, and also reaches for
// `axios.defaults` (AuthContext sets the Authorization header, ToastContext sets a
// timeout) and `axios.interceptors` (ToastContext installs a global error handler).
// Vitest's automock does not reproduce those, so the module factory below builds the
// full surface explicitly.
//
// Usage — the vi.mock factory is hoisted, so the import must happen inside it:
//
//   vi.mock("axios", async () => (await import("./tests/axiosMock.js")).axiosModuleFactory())
//
//   import axios from "axios"
//   import { mockApi, httpError } from "./tests/axiosMock.js"
//
//   const api = mockApi(axios, {
//     "GET /api/tasks": { tasks: [] },
//     "POST /api/work-sessions/start": { session: {...}, elapsedSeconds: 0, isRunning: true }
//   })

const METHODS = ["get", "post", "put", "patch", "delete", "request", "head", "options"]

export const axiosModuleFactory = () => {
  const instance = Object.fromEntries(METHODS.map(method => [method, vi.fn()]))

  instance.defaults = { headers: { common: {} }, timeout: 0 }
  instance.interceptors = {
    request: { use: vi.fn(() => 0), eject: vi.fn() },
    response: { use: vi.fn(() => 0), eject: vi.fn() }
  }
  instance.create = vi.fn(() => instance)
  instance.isAxiosError = (err) => Boolean(err?.response || err?.request)

  return { default: instance }
}

/** An axios-shaped rejection, so `err.response.status` / `.data.code` behave as in the app. */
export const httpError = (status, data = {}) => {
  const error = new Error(data.error ?? data.message ?? `Request failed with status ${status}`)
  error.response = { status, data }
  error.isAxiosError = true
  return error
}

/** An axios-shaped network failure — request sent, no response. This is the branch
 *  ToastContext turns into "Network connection error". */
export const networkError = (message = "Network Error") => {
  const error = new Error(message)
  error.request = {}
  error.isAxiosError = true
  return error
}

/**
 * Route the mocked axios.
 *
 * Keys are `"<METHOD> <url fragment>"`; the fragment is matched against the end of the
 * request URL, so tests write the API path and ignore the base URL. A value may be a
 * plain body, an Error (rejected), or a function receiving `(url, ...args)`.
 *
 * An unrouted request rejects loudly rather than resolving `undefined` — a silent
 * undefined surfaces later as an unrelated render error and wastes an afternoon.
 */
export const mockApi = (axios, routes = {}) => {
  const calls = []
  const parse = (key) => {
    const [method, ...rest] = key.split(" ")
    return { method: method.toLowerCase(), fragment: rest.join(" ") }
  }
  let entries = Object.entries(routes).map(([key, value]) => ({ ...parse(key), value }))

  const handler = (method) => async (url, ...args) => {
    calls.push({ method, url, args })
    const match = entries.find(entry => entry.method === method && String(url).includes(entry.fragment))
    if (!match) {
      throw httpError(501, { error: `No axios mock configured for ${method.toUpperCase()} ${url}` })
    }
    const value = typeof match.value === "function" ? await match.value(url, ...args) : match.value
    if (value instanceof Error) throw value
    return { data: value, status: 200, headers: {}, config: { url } }
  }

  for (const method of ["get", "post", "put", "patch", "delete"]) {
    axios[method].mockImplementation(handler(method))
  }

  return {
    calls,
    /** Every call matching a method and URL fragment — for asserting what was requested. */
    callsTo: (method, fragment = "") =>
      calls.filter(call => call.method === method.toLowerCase() && call.url.includes(fragment)),
    /** Replace or add routes mid-test, e.g. to make a retry succeed after a failure. */
    setRoutes: (next) => {
      entries = Object.entries(next).map(([key, value]) => ({ ...parse(key), value }))
    }
  }
}
