import express from "express"
import { getActiveSession, startSession, pauseSession, resumeSession, stopSession, getTodayTrackedHours } from "../controllers/workSessionController.js"
import { authenticateJWT } from "../middleware/authMiddleware.js"

const router = express.Router()

// All routes require authentication
router.use(authenticateJWT)

router.get("/active", getActiveSession)
router.get("/today-hours", getTodayTrackedHours)
router.post("/start", startSession)
router.post("/pause", pauseSession)
router.post("/resume", resumeSession)
router.post("/stop", stopSession)

export default router
