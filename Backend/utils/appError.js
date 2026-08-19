class AppError extends Error {
  // `code` is an optional machine-readable identifier (e.g. "TASK_LOCKED") for cases
  // where the client must branch on the specific failure rather than just show the
  // message — see CLAUDE.md §4. Omitting it keeps the previous two-arg behaviour.
  constructor(message, statusCode, code = null) {
    super(message)

    this.statusCode = statusCode
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error"
    this.code = code
    this.isOperational = true

    Error.captureStackTrace(this, this.constructor)
  }
}

export default AppError
