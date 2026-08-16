import AppError from "../utils/appError.js"

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}.`
  return new AppError(message, 400)
}

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message)
  const message = `Invalid input data. ${errors.join(". ")}`
  return new AppError(message, 400)
}

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyPattern || {})[0] || "field"
  const message = `Duplicate field value entered for ${field}. Please use another value.`
  return new AppError(message, 400)
}

const handleJWTError = () => {
  return new AppError("Invalid authentication token. Please log in again.", 401)
}

const handleJWTExpiredError = () => {
  return new AppError("Your session token has expired. Please log in again.", 401)
}

const sendErrorDev = (err, req, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
    ...(typeof err.code === "string" && { code: err.code }),
    error: err,
    stack: err.stack
  })
}

const sendErrorProd = (err, req, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      error: err.message,
      // Only AppError's string codes are surfaced — Mongoose puts numeric codes
      // (e.g. 11000) on its own errors, which must never leak to the client.
      ...(typeof err.code === "string" && { code: err.code })
    })
  } else {
    // Unintended errors or server faults: log internally and send generic response
    console.error("ERROR 💥:", err)
    res.status(500).json({
      status: "error",
      error: "Something went wrong. Please try again later."
    })
  }
}

export const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500
  err.status = err.status || "error"

  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development"

  if (isDev) {
    sendErrorDev(err, req, res)
  } else {
    let error = Object.assign(err)
    error.message = err.message

    if (error.name === "CastError") error = handleCastErrorDB(error)
    if (error.name === "ValidationError") error = handleValidationErrorDB(error)
    if (error.code === 11000) error = handleDuplicateFieldsDB(error)
    if (error.name === "JsonWebTokenError") error = handleJWTError()
    if (error.name === "TokenExpiredError") error = handleJWTExpiredError()

    sendErrorProd(error, req, res)
  }
}
export default globalErrorHandler
