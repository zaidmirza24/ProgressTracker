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
  // Skip entirely when explicitly opted out — the E2E suite's five flows run every
  // login through the real form across a single long-lived backend process and a
  // single source IP (Playwright's own browser), so a normal run legitimately exceeds
  // this limit despite having no real user behind it. Never set by anything but
  // e2e/playwright.config.js: the limiter's own behaviour (correct password also
  // blocked once tripped, block clears after the window) is already covered by the
  // backend integration suite, so E2E doesn't need to re-prove it — it just needs to
  // not be blocked by it.
  skip: () => process.env.DISABLE_LOGIN_RATE_LIMIT === "true",
  message: { success: false, message: "Too many login attempts. Please try again in a few minutes.", code: "TOO_MANY_ATTEMPTS" }
})

router.post("/login", loginLimiter, login)
router.get("/me", authenticateJWT, getMe)

export default router
