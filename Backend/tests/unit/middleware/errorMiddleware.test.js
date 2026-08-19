import { describe, it, expect, vi, afterEach } from "vitest"
import globalErrorHandler from "../../../middleware/errorMiddleware.js"
import AppError from "../../../utils/appError.js"

// globalErrorHandler is the final translation step between "whatever failed inside a
// route" and "what the client is allowed to see" (CLAUDE.md §17 — never leak raw
// technical errors). It is deliberately tested directly against constructed error
// objects rather than through HTTP: forcing every Mongoose/JWT error shape through a
// real route would be brittle and would duplicate what the route's own tests already
// cover, while this function's own branching is what actually needs verifying.

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

describe("globalErrorHandler", () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  describe("in production", () => {
    it("passes an operational AppError's message and status straight through", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()

      globalErrorHandler(new AppError("Task not found", 404, "TASK_NOT_FOUND"), {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(404)
      expect(res.json).toHaveBeenCalledWith({ status: "fail", error: "Task not found", code: "TASK_NOT_FOUND" })
    })

    it("omits code when the AppError was not given one", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()

      globalErrorHandler(new AppError("Access denied", 403), {}, res, () => {})

      expect(res.json).toHaveBeenCalledWith({ status: "fail", error: "Access denied" })
    })

    it("maps a Mongoose CastError to a 400 naming the bad field, not the raw driver error", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("Cast failed"), { name: "CastError", path: "assignedTo", value: "not-an-id" })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({ status: "fail", error: "Invalid assignedTo: not-an-id." })
    })

    it("maps a Mongoose ValidationError to a 400 listing every field's message", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("validation failed"), {
        name: "ValidationError",
        errors: {
          title: { message: "Title is required" },
          priority: { message: "Invalid priority" }
        }
      })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(400)
      expect(res.json).toHaveBeenCalledWith({
        status: "fail",
        error: "Invalid input data. Title is required. Invalid priority"
      })
    })

    it("maps a duplicate-key error (11000) to a 400 naming the field, never the numeric Mongo code", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("E11000 duplicate key"), { code: 11000, keyPattern: { email: 1 } })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(400)
      const body = res.json.mock.calls[0][0]
      expect(body.error).toBe("Duplicate field value entered for email. Please use another value.")
      expect(body.code).toBeUndefined() // the numeric Mongo code must never leak to the client
    })

    it("falls back to a generic field label when the duplicate-key error has no keyPattern", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("E11000 duplicate key"), { code: 11000 })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.json.mock.calls[0][0].error).toBe("Duplicate field value entered for field. Please use another value.")
    })

    it("maps JsonWebTokenError to a 401 telling the user to log in again", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("jwt malformed"), { name: "JsonWebTokenError" })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ status: "fail", error: "Invalid authentication token. Please log in again." })
    })

    it("maps TokenExpiredError to its own distinct 401 message", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const err = Object.assign(new Error("jwt expired"), { name: "TokenExpiredError" })

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ status: "fail", error: "Your session token has expired. Please log in again." })
    })

    it("collapses a non-operational (programmer) error to a generic 500 and logs it internally, never echoing the raw message", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const err = new TypeError("Cannot read properties of undefined")

      globalErrorHandler(err, {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ status: "error", error: "Something went wrong. Please try again later." })
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it("defaults a bare thrown error with no statusCode/status to a 500", () => {
      process.env.NODE_ENV = "production"
      const res = mockRes()
      vi.spyOn(console, "error").mockImplementation(() => {})

      globalErrorHandler(new Error("boom"), {}, res, () => {})

      expect(res.status).toHaveBeenCalledWith(500)
    })
  })

  describe("in development", () => {
    it("includes the stack trace and raw error object to aid local debugging", () => {
      process.env.NODE_ENV = "development"
      const res = mockRes()
      const err = new AppError("Task not found", 404, "TASK_NOT_FOUND")

      globalErrorHandler(err, {}, res, () => {})

      const body = res.json.mock.calls[0][0]
      expect(body.message).toBe("Task not found")
      expect(body.code).toBe("TASK_NOT_FOUND")
      expect(body.stack).toBeDefined()
      expect(body.error).toBe(err)
    })

    it("treats an unset NODE_ENV as development", () => {
      delete process.env.NODE_ENV
      const res = mockRes()

      globalErrorHandler(new AppError("x", 400), {}, res, () => {})

      expect(res.json.mock.calls[0][0].stack).toBeDefined()
    })
  })
})
