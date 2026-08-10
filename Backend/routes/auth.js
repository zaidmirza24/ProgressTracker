import express from "express"
import { login, getMe } from "../controllers/authController.js"
import { authenticateJWT } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/login", login)
router.get("/me", authenticateJWT, getMe)

export default router
