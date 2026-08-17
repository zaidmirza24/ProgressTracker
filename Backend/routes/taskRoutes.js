import express from "express"
import { getTasks, createTask, updateTask, cancelTask, setTaskBlocked, updateTaskStatus, addComment, ensureDailyTasks, getProgressReport } from "../controllers/taskController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateJWT)

router.get("/", getTasks)
router.get("/daily", requireRole(["employee", "manager", "super_admin"]), ensureDailyTasks)
router.get("/report", requireRole(["super_admin", "manager", "employee"]), getProgressReport)
router.post("/", requireRole(["manager", "super_admin", "employee"]), createTask)
// Field edits (incl. reassignment). Role nuance is handled inside the controller —
// employees may edit a narrower field set on their own self-created tasks — so this
// is intentionally not gated by requireRole, matching updateTaskStatus below.
router.patch("/:id", updateTask)
router.delete("/:id", cancelTask)
// Blocked is orthogonal to status and has its own authorization (the assignee may
// declare their own task blocked), so it gets its own endpoint rather than riding on
// the field-edit PATCH.
router.patch("/:id/blocked", setTaskBlocked)
router.put("/:id/status", updateTaskStatus)
router.post("/:id/comments", addComment)

export default router
