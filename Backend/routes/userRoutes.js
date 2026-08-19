import express from "express"
import { getUsers, createUser, updateUser, deactivateUser } from "../controllers/userController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/", getUsers)
router.post("/", requireRole(["super_admin"]), createUser)
router.put("/:id", requireRole(["super_admin"]), updateUser)
// Soft-delete (Core Rule 2). Refuses to strand open work — see the controller.
router.patch("/:id/deactivate", requireRole(["super_admin"]), deactivateUser)

export default router
