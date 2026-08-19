import request from "supertest"
import app from "../../app.js"
import { tokenFor } from "./auth.js"

const METHODS = ["get", "post", "put", "patch", "delete"]

/**
 * Unauthenticated request against the real Express app.
 *   await api().get("/api/health").expect(200)
 */
export const api = () => request(app)

/**
 * Request as a given user, or as a raw token string.
 *   await asUser(employee).get("/api/tasks").expect(200)
 *   await asToken(MALFORMED_TOKEN).get("/api/tasks").expect(401)
 *
 * Returned as an explicit method map rather than a supertest agent: agents persist
 * cookies and default-header behaviour that varies between superagent versions, and
 * every request here needs exactly one header set.
 */
export const asToken = (token) =>
  Object.fromEntries(
    METHODS.map(method => [
      method,
      (url) => request(app)[method](url).set("Authorization", `Bearer ${token}`)
    ])
  )

export const asUser = (user, options) => asToken(tokenFor(user, options))
