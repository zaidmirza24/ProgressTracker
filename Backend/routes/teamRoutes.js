import express from "express"
import { getTeams, createTeam, updateTeam, deactivateTeam } from "../controllers/teamController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/", getTeams)
router.post("/", requireRole(["super_admin"]), createTeam)
router.put("/:id", requireRole(["super_admin"]), updateTeam)
router.patch("/:id/deactivate", requireRole(["super_admin"]), deactivateTeam)

export default router
