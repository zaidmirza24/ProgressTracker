import express from "express"
import { getTasks, createTask, updateTaskStatus, addComment, ensureDailyTasks, getProgressReport } from "../controllers/taskController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateJWT)

router.get("/", getTasks)
router.get("/daily", requireRole(["employee"]), ensureDailyTasks)
router.get("/report", requireRole(["super_admin", "manager"]), getProgressReport)
router.post("/", requireRole(["manager", "super_admin", "employee"]), createTask)
router.put("/:id/status", updateTaskStatus)
router.post("/:id/comments", addComment)

export default router
