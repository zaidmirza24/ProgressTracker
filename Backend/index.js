import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import authRoutes from "./routes/auth.js"
import departmentRoutes from "./routes/departmentRoutes.js"
import teamRoutes from "./routes/teamRoutes.js"
import userRoutes from "./routes/userRoutes.js"
import taskRoutes from "./routes/taskRoutes.js"
import workSessionRoutes from "./routes/workSessionRoutes.js"
import dailyWorkLogRoutes from "./routes/dailyWorkLogRoutes.js"
import globalErrorHandler from "./middleware/errorMiddleware.js"
import AppError from "./utils/appError.js"

// Handle synchronous errors that occur outside Express context
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION! 💥 Shutting down...")
  console.error(err.name, err.message, err.stack)
  process.exit(1)
})

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

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

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Register Route Handlers
app.use("/api/auth", authRoutes)
app.use("/api/departments", departmentRoutes)
app.use("/api/teams", teamRoutes)
app.use("/api/users", userRoutes)
app.use("/api/tasks", taskRoutes)
app.use("/api/work-sessions", workSessionRoutes)
app.use("/api/daily-work-logs", dailyWorkLogRoutes)

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