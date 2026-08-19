import express from "express"
import { getLogs, createLog, getTodayContext } from "../controllers/dailyWorkLogController.js"
import { authenticateJWT } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/today-context", getTodayContext)
router.get("/", getLogs)
// Anyone may record their OWN day. This was employee-only, which contradicted the
// "everyone is a worker" model (Iteration 15) that gave managers and admins their own
// tasks, timers, daily tasks and progress — the daily reflection was the one part of
// that they were still locked out of. createLog always writes for req.user.id, so
// there is nothing here for a caller to widen.
router.post("/", createLog)

export default router
