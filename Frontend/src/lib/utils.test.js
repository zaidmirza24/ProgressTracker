import { describe, it, expect } from "vitest"
import { cn, extractErrorMessage } from "./utils"

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("a", "b")).toBe("a b")
  })

  it("drops falsy values so conditional classes are safe", () => {
    const isActive = false
    expect(cn("a", isActive && "b", null, undefined, "c")).toBe("a c")
  })

  it("lets a later Tailwind utility win over an earlier conflicting one", () => {
    // The reason twMerge is here at all: a component's own padding must be able to
    // override a variant's without depending on stylesheet order.
    expect(cn("px-2", "px-4")).toBe("px-4")
    expect(cn("text-sm text-muted-foreground", "text-lg")).toBe("text-muted-foreground text-lg")
  })

  it("accepts arrays and conditional objects", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c")
  })
})

describe("extractErrorMessage", () => {
  // Every user-facing error message in the app goes through this. A miss here shows a
  // raw technical string, or a useless generic one where the server sent something
  // actionable (Standards §17).
  it("prefers the backend's operational error string", () => {
    // The shape errorMiddleware's production branch sends.
    const error = { response: { data: { status: "fail", error: "Task not found", code: "TASK_NOT_FOUND" } } }
    expect(extractErrorMessage(error)).toBe("Task not found")
  })

  it("accepts a `message` field as well", () => {
    const error = { response: { data: { message: "Too many login attempts." } } }
    expect(extractErrorMessage(error)).toBe("Too many login attempts.")
  })

  it("reaches into a nested error object", () => {
    // The development branch of errorMiddleware nests the AppError itself.
    const error = { response: { data: { error: { message: "Deep message" } } } }
    expect(extractErrorMessage(error)).toBe("Deep message")
  })

  it("falls back to the exception's own message when there is no response", () => {
    // A network failure never reaches the server, so there is no body to read.
    expect(extractErrorMessage(new Error("Network Error"))).toBe("Network Error")
  })

  it("passes a plain string straight through", () => {
    expect(extractErrorMessage("Something specific")).toBe("Something specific")
  })

  it("uses the supplied default when there is nothing to extract", () => {
    expect(extractErrorMessage(null)).toBe("An unexpected error occurred")
    expect(extractErrorMessage(null, "Login failed.")).toBe("Login failed.")
    expect(extractErrorMessage({}, "Login failed.")).toBe("Login failed.")
  })

  it("ignores a non-string error field rather than rendering [object Object]", () => {
    const error = { response: { data: { error: { code: 500 } } } }
    expect(extractErrorMessage(error, "Fallback")).toBe("Fallback")
  })
})
