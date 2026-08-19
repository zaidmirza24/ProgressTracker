import express from "express"
import {
  getCalendarContext,
  getSettings,
  updateSettings,
  getAbsences,
  createAbsence,
  deleteAbsence
} from "../controllers/calendarController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

// Everything the frontend needs to compute capacity with the server's own rules.
// Readable by any authenticated user; absences within are scoped by role in the controller.
router.get("/context", getCalendarContext)

router.get("/settings", getSettings)
router.put("/settings", requireRole(["super_admin"]), updateSettings)

// Absence create/delete is manager+ ; the controller further restricts a manager to
// their own direct reports.
router.get("/absences", getAbsences)
router.post("/absences", requireRole(["manager", "super_admin"]), createAbsence)
router.delete("/absences/:id", requireRole(["manager", "super_admin"]), deleteAbsence)

export default router
