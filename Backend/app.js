import "dotenv/config"
import express from "express"
import cors from "cors"
import authRoutes from "./routes/auth.js"
import departmentRoutes from "./routes/departmentRoutes.js"
import teamRoutes from "./routes/teamRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import taskRoutes from "./routes/taskRoutes.js"
import taskTemplateRoutes from "./routes/taskTemplateRoutes.js"
import workSessionRoutes from "./routes/workSessionRoutes.js"
import dailyWorkLogRoutes from "./routes/dailyWorkLogRoutes.js"
import calendarRoutes from "./routes/calendarRoutes.js"
import globalErrorHandler from "./middleware/errorMiddleware.js"
import AppError from "./utils/appError.js"

// The Express application, with no server socket and no database connection of its own.
//
// Separated from index.js so tests can drive the real app through supertest without
// binding a port or starting the cron — index.js remains the only place that connects
// to MongoDB, schedules the daily-task job, and listens. Nothing about request handling
// changed in the split.
//
// `dotenv/config` is imported here (not called in index.js only) because ES module
// imports are hoisted: index.js's `dotenv.config()` statement would otherwise run
// AFTER this module had already been evaluated, leaving env-dependent module-level
// values (e.g. CLIENT_URL below) unset.

// Fail fast on missing secrets rather than at the first request that needs one.
//
// Without JWT_SECRET, jwt.sign throws inside the login handler and every single login
// returns a 500 with no indication of the cause — the server looks healthy, answers its
// health check, and is completely unusable. A process that refuses to start is far
// easier to diagnose.
//
// Skipped under NODE_ENV=test, where tests/setup/env.js supplies its own value before
// anything is imported.
if (!process.env.JWT_SECRET && process.env.NODE_ENV !== "test") {
  console.error("FATAL: JWT_SECRET is not set. Refusing to start — every login would fail with a 500.")
  process.exit(1)
}

const app = express()

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4173",
  process.env.CLIENT_URL
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true
}))
app.use(express.json())

// Register Route Handlers
app.use("/api/auth", authRoutes)
app.use("/api/departments", departmentRoutes)
app.use("/api/teams", teamRoutes)
app.use("/api/users", userRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/task-templates", taskTemplateRoutes)
app.use("/api/work-sessions", workSessionRoutes)
app.use("/api/daily-work-logs", dailyWorkLogRoutes)
app.use("/api/calendar", calendarRoutes)

// Health-check API routes
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "API is running" })
})

// Lightweight keep-alive endpoint for external uptime monitors (e.g. UptimeRobot)
// Intentionally has no DB query, no auth, and no business logic.
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" })
})

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Employee Work Management API is running",
    timestamp: new Date().toISOString()
  })
})

// Unhandled route fallback
app.all(/.*/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404))
})

// Global Error Handler Middleware (must be registered last)
app.use(globalErrorHandler)

export default app
