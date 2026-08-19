import { describe, it, expect } from "vitest"
import { api } from "../helpers/api.js"
import { makeUser, TEST_PASSWORD } from "../factories/index.js"

// The login rate limiter, in its own file.
//
// express-rate-limit keeps its counter in module-level memory keyed by IP, and every
// supertest request arrives from the same address. Exhausting it here would make any
// later login test in the same file fail for the wrong reason, so this is isolated —
// Vitest gives each test file its own module registry, which resets the counter.

const LIMIT = 10

describe("POST /api/auth/login rate limiting", () => {
  it("blocks further attempts once the per-IP limit is reached", async () => {
    await makeUser({ email: "target@test.local" })

    // An office of ~10 people has no legitimate reason to hit this endpoint dozens of
    // times a minute. Without the limiter, bcrypt's compare time is the only friction
    // against brute-forcing a known email address.
    for (let attempt = 1; attempt <= LIMIT; attempt++) {
      await api().post("/api/auth/login")
        .send({ email: "target@test.local", password: `guess-${attempt}` })
        .expect(401)
    }

    const blocked = await api().post("/api/auth/login")
      .send({ email: "target@test.local", password: "guess-11" })
      .expect(429)

    expect(blocked.body.code).toBe("TOO_MANY_ATTEMPTS")
    expect(blocked.body.message).toMatch(/too many/i)
  })

  it("blocks the correct password too, once the limit is reached", async () => {
    // The limiter must not be bypassable by finally guessing right — otherwise it only
    // slows an attacker down until the moment they succeed.
    await api().post("/api/auth/login")
      .send({ email: "target@test.local", password: TEST_PASSWORD })
      .expect(429)
  })

  it("does not rate limit other endpoints", async () => {
    // The limiter is mounted on the login route only; exhausting it must not lock the
    // whole API for everyone sharing an office IP.
    await api().get("/api/health").expect(200)
  })
})
