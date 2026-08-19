import { describe, it, expect } from "vitest"
import User from "../../models/User.js"
import { api, asUser, asToken } from "../helpers/api.js"
import { tokenFor, expiredTokenFor, forgedTokenFor, MALFORMED_TOKEN } from "../helpers/auth.js"
import { makeUser, TEST_PASSWORD } from "../factories/index.js"

// Authentication: who is this caller, and is that claim still true?
//
// NOTE ON REQUEST BUDGET: POST /api/auth/login is rate limited to 10 attempts per IP per
// 15 minutes, and the limiter counts every request including successful ones. This file
// stays under that ceiling on purpose; the limiter itself is exercised in
// auth-rate-limit.test.js, which runs in its own file so its exhausted counter cannot
// leak into these tests.

describe("POST /api/auth/login", () => {
  it("issues a token and the caller's own profile", async () => {
    const user = await makeUser({ role: "employee", email: "ana@test.local" })

    const res = await api().post("/api/auth/login")
      .send({ email: "ana@test.local", password: TEST_PASSWORD })
      .expect(200)

    expect(res.body.token).toBeTypeOf("string")
    expect(res.body.user).toMatchObject({ email: "ana@test.local", role: "employee", name: user.name })
  })

  it("never returns the password hash", async () => {
    await makeUser({ email: "ana@test.local" })
    const res = await api().post("/api/auth/login")
      .send({ email: "ana@test.local", password: TEST_PASSWORD })
      .expect(200)

    expect(JSON.stringify(res.body)).not.toContain("passwordHash")
    expect(res.body.user.passwordHash).toBeUndefined()
  })

  it("rejects a wrong password without revealing that the account exists", async () => {
    await makeUser({ email: "ana@test.local" })
    const res = await api().post("/api/auth/login")
      .send({ email: "ana@test.local", password: "not-the-password" })
      .expect(401)

    expect(res.body.error).toBe("Invalid email or password")
  })

  it("gives an unknown email the identical response, so accounts cannot be enumerated", async () => {
    const res = await api().post("/api/auth/login")
      .send({ email: "nobody@test.local", password: TEST_PASSWORD })
      .expect(401)

    expect(res.body.error).toBe("Invalid email or password")
  })

  it("refuses a deactivated account even with the correct password", async () => {
    await makeUser({ email: "gone@test.local", isActive: false })
    await api().post("/api/auth/login")
      .send({ email: "gone@test.local", password: TEST_PASSWORD })
      .expect(401)
  })

  it("requires both fields", async () => {
    await api().post("/api/auth/login").send({ email: "ana@test.local" }).expect(400)
  })
})

describe("GET /api/auth/me", () => {
  it("returns the caller's profile without the password hash", async () => {
    const user = await makeUser({ role: "manager" })
    const res = await asUser(user).get("/api/auth/me").expect(200)

    expect(res.body.user._id).toBe(user._id.toString())
    expect(res.body.user.passwordHash).toBeUndefined()
  })

  it("requires a token", async () => {
    await api().get("/api/auth/me").expect(401)
  })
})

describe("token validation", () => {
  it("rejects a request with no Authorization header", async () => {
    const res = await api().get("/api/tasks").expect(401)
    expect(res.body.error).toBe("Authentication token required")
  })

  it("rejects a header that is not a Bearer token", async () => {
    const user = await makeUser()
    await api().get("/api/tasks").set("Authorization", tokenFor(user)).expect(401)
    await api().get("/api/tasks").set("Authorization", `Basic ${tokenFor(user)}`).expect(401)
  })

  it("rejects a malformed token", async () => {
    await asToken(MALFORMED_TOKEN).get("/api/tasks").expect(401)
    await asToken("").get("/api/tasks").expect(401)
  })

  it("rejects an expired token", async () => {
    const user = await makeUser()
    await asToken(expiredTokenFor(user)).get("/api/tasks").expect(401)
  })

  it("rejects a token signed with the wrong key", async () => {
    // Proves the signature is verified, not merely decoded — otherwise anyone could
    // mint themselves a super_admin token.
    const user = await makeUser()
    await asToken(forgedTokenFor(user)).get("/api/tasks").expect(401)
  })

  it("rejects a well-formed token for a user who no longer exists", async () => {
    const user = await makeUser()
    const token = tokenFor(user)
    await User.deleteOne({ _id: user._id })

    await asToken(token).get("/api/tasks").expect(401)
  })

  it("rejects a still-valid token once the account is deactivated", async () => {
    // The reason authenticateJWT re-reads the user on every request. Without it a
    // deactivated employee keeps full access under their old token for up to 24 hours —
    // the token proves who they WERE at login, not who they are now.
    const user = await makeUser({ role: "employee" })
    const token = tokenFor(user)

    await asToken(token).get("/api/tasks").expect(200)

    await User.updateOne({ _id: user._id }, { isActive: false })
    await asToken(token).get("/api/tasks").expect(401)
  })

  it("uses the CURRENT role from the database, not the role baked into the token", async () => {
    // A token minted while someone was a manager must not keep manager powers after
    // they are demoted.
    const user = await makeUser({ role: "manager" })
    const managerToken = tokenFor(user)

    await asToken(managerToken).get("/api/work-sessions/active-team").expect(200)

    await User.updateOne({ _id: user._id }, { role: "employee" })
    await asToken(managerToken).get("/api/work-sessions/active-team").expect(403)
  })
})
