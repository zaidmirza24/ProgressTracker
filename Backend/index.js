import mongoose from "mongoose"
import app from "./app.js"
import { scheduleDailyTaskCron } from "./services/dailyTaskCron.js"

// Server entry point: process-level error handling, the database connection, the
// midnight provisioning cron, and the listening socket. The Express application
// itself lives in app.js so tests can exercise it without any of the above.

// Handle synchronous errors that occur outside Express context
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...")
  console.error(err.name, err.message, err.stack)
  process.exit(1)
})

const PORT = process.env.PORT || 3000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

// Connect to MongoDB, then schedule the midnight daily-task provisioning job: creates
// today's daily tasks for every active employee (and carries forward yesterday's
// incomplete ones) so today's tasks and the capacity numbers derived from them (Locked
// Logic §6) exist before anyone logs in, rather than depending on each employee opening
// their dashboard first. GET /api/tasks/daily (see taskController.js) still self-heals
// per-employee on login for the same day in case this job hasn't run yet (e.g. server
// was down at midnight). Non-working days (weekends/holidays) and absent employees are
// skipped inside provisionDailyTasksForAllEmployees, so the same rule applies to both
// entry points. Scheduling needs a DB read (OrgSettings.timezone), so it waits for the
// connection rather than running synchronously at import time.
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB successfully")
    await scheduleDailyTaskCron()
  })
  .catch((err) => {
    // Previously this only logged: the server carried on listening, answered /health
    // with "ok", and failed every real request. An uptime monitor would report the
    // service as healthy while nothing worked. Exit instead, so the platform restarts
    // it and the failure is visible.
    console.error("FATAL: could not connect to MongoDB.", err.message)
    process.exit(1)
  })

// Start Server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

// Graceful handler for server errors (like port already in use)
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`\n❌ Error: Port ${PORT} is already in use!`)
    console.error("Please close the conflicting application or configure another port in your .env file.\n")
    process.exit(1)
  } else {
    console.error("Server binding error:", error)
  }
})

// Handle asynchronous promise rejections outside Express context
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION! 💥 Shutting down...")
  console.error(err.name, err.message)

  // Give active requests time to finish before terminating
  server.close(() => {
    mongoose.connection.close()
      .then(() => {
        console.log("Database connection closed. Exiting process.")
        process.exit(1)
      })
      .catch(() => process.exit(1))
  })
})
