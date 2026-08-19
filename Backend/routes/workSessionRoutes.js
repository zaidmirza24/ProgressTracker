import express from "express"
import { getActiveSession, startSession, pauseSession, resumeSession, stopSession, getTodayTrackedHours, getActiveTeamSessions } from "../controllers/workSessionController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateJWT)

router.get("/active", getActiveSession)
router.get("/active-team", requireRole(["manager", "super_admin"]), getActiveTeamSessions)
router.get("/today-hours", getTodayTrackedHours)
router.post("/start", startSession)
router.post("/pause", pauseSession)
router.post("/resume", resumeSession)
router.post("/stop", stopSession)

export default router
