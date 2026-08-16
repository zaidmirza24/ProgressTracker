import express from "express"
import { getLogs, createLog, getTodayContext } from "../controllers/dailyWorkLogController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/today-context", getTodayContext)
router.get("/", getLogs)
router.post("/", requireRole(["employee"]), createLog)

export default router
