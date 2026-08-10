import express from "express"
import { getTasks, createTask, updateTaskStatus, addComment } from "../controllers/taskController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateJWT)

router.get("/", getTasks)
router.post("/", requireRole(["manager", "super_admin", "employee"]), createTask)
router.put("/:id/status", updateTaskStatus)
router.post("/:id/comments", addComment)

export default router
