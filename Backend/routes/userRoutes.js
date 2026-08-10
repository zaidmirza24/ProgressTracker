import express from "express"
import { getUsers, createUser, updateUser } from "../controllers/userController.js"
import { authenticateJWT, requireRole } from "../middleware/authMiddleware.js"

const router = express.Router()

router.use(authenticateJWT)

router.get("/", getUsers)
router.post("/", requireRole(["super_admin"]), createUser)
router.put("/:id", requireRole(["super_admin"]), updateUser)

export default router
