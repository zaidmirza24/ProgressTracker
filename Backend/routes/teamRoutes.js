import express from "express"
import { getTeams, createTeam, updateTeam } from "../controllers/teamController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/", getTeams)
router.post("/", requireRole(["super_admin"]), createTeam)
router.put("/:id", requireRole(["super_admin"]), updateTeam)

export default router
