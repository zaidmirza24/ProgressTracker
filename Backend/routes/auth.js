import express from "express"
import rateLimit from "express-rate-limit"
import { login, getMe } from "../controllers/authController.js"
import { authenticateJWT } from "../middleware/authMiddleware.js"

const router = express.Router()

// Throttles password-guessing: an office of ~10 people has no legitimate reason to hit
// this endpoint dozens of times a minute, so cap per-IP attempts rather than leaving
// bcrypt's compare time as the only friction against brute-forcing a known email.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in a few minutes.", code: "TOO_MANY_ATTEMPTS" }
})

router.post("/login", loginLimiter, login)
router.get("/me", authenticateJWT, getMe)

export default router
