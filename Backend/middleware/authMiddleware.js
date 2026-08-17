import jwt from "jsonwebtoken"
import User from "../models/User.js"
import asyncHandler from "../utils/asyncHandler.js"

export const authenticateJWT = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication token required" })
  }

  const token = authHeader.split(" ")[1]

  let decoded
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }

  // Re-check against the DB on every request rather than trusting the token's claims
  // for the life of its 1-day expiry. Without this, a deactivated user (or one whose
  // role just changed) keeps full access under their old token for up to 24h — the
  // token is only proof of who they were when they logged in, not who they are now.
  // Kept outside the try/catch above so a DB error surfaces as a 500 through the
  // global error handler instead of being misreported as an invalid token.
  const user = await User.findById(decoded.id).select("role isActive")
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }

  req.user = { id: decoded.id, role: user.role }
  next()
})

export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied: Insufficient permissions" })
    }
    next()
  }
}
