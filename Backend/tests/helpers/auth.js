import jwt from "jsonwebtoken"

// Token minting for tests. Mirrors exactly what authController.login issues — same
// claims (`id`, `role`), same secret, same 1-day default expiry — so a test token is
// indistinguishable from a real one to authenticateJWT.
//
// Tests sign their own tokens rather than logging in over HTTP for every request: the
// login path is itself under test elsewhere, and bcrypt.compare on every setup step
// would dominate the suite's runtime.

export const tokenFor = (user, { expiresIn = "1d", secret = process.env.JWT_SECRET } = {}) =>
  jwt.sign({ id: String(user._id ?? user.id), role: user.role }, secret, { expiresIn })

// An already-expired token, for asserting the 401 path.
export const expiredTokenFor = (user) =>
  jwt.sign(
    { id: String(user._id ?? user.id), role: user.role, exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET
  )

// A structurally valid token signed with the wrong key — proves the signature is
// actually verified, not merely decoded.
export const forgedTokenFor = (user) =>
  tokenFor(user, { secret: "not-the-real-signing-key" })

export const MALFORMED_TOKEN = "this.is.not-a-jwt"
