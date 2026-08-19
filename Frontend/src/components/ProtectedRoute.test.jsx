import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import ProtectedRoute from "./ProtectedRoute"
import AuthContext from "../context/AuthContext"

// Route gating.
//
// This is a USABILITY control, not a security one — the server enforces every permission
// independently (see Backend/tests/integration/authorization-matrix.test.js), and hiding
// a route in the UI protects nothing on its own. What it must get right is never showing
// someone a screen that will fail for them, and never bouncing a legitimate user out
// mid-session.
//
// The `loading` case is the one worth caring about most: rendering the redirect before
// the session has been verified would throw an already-signed-in user back to the login
// page on every refresh.

const withAuth = (auth, ui) => render(
  <AuthContext.Provider value={{ login: vi.fn(), logout: vi.fn(), token: null, ...auth }}>
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/unauthorized" element={<p>Not allowed</p>} />
      </Routes>
    </MemoryRouter>
  </AuthContext.Provider>
)

const Secret = () => <p>Secret content</p>

describe("while the session is being verified", () => {
  it("waits instead of redirecting", async () => {
    // On every page load the token is re-verified against the server. Redirecting during
    // that window would sign a valid user out on refresh.
    withAuth({ user: null, loading: true }, <ProtectedRoute><Secret /></ProtectedRoute>)

    expect(screen.getByText(/verifying session/i)).toBeDefined()
    expect(screen.queryByText("Login page")).toBeNull()
    expect(screen.queryByText("Secret content")).toBeNull()
  })
})

describe("when nobody is signed in", () => {
  it("sends the visitor to the login page", async () => {
    withAuth({ user: null, loading: false }, <ProtectedRoute><Secret /></ProtectedRoute>)

    expect(screen.getByText("Login page")).toBeDefined()
    expect(screen.queryByText("Secret content")).toBeNull()
  })
})

describe("when signed in", () => {
  it("renders the page when no roles are required", async () => {
    withAuth({ user: { role: "employee" }, loading: false }, <ProtectedRoute><Secret /></ProtectedRoute>)
    expect(screen.getByText("Secret content")).toBeDefined()
  })

  it.each([
    ["employee", ["employee"]],
    ["manager", ["manager", "super_admin"]],
    ["super_admin", ["manager", "super_admin"]]
  ])("renders the page for a permitted %s", async (role, allowedRoles) => {
    withAuth(
      { user: { role }, loading: false },
      <ProtectedRoute allowedRoles={allowedRoles}><Secret /></ProtectedRoute>
    )
    expect(screen.getByText("Secret content")).toBeDefined()
  })

  it.each([
    ["employee", ["manager", "super_admin"]],   // /team-tasks, /my-work
    ["manager", ["super_admin"]],               // /super-admin/organization
    ["super_admin", ["employee"]]               // /employee
  ])("redirects a %s away from a route they may not use", async (role, allowedRoles) => {
    withAuth(
      { user: { role }, loading: false },
      <ProtectedRoute allowedRoles={allowedRoles}><Secret /></ProtectedRoute>
    )

    expect(screen.getByText("Not allowed")).toBeDefined()
    expect(screen.queryByText("Secret content")).toBeNull()
  })

  it("sends an unauthorised user to the explanation page, not back to login", async () => {
    // Being signed in as the wrong role is a different problem from not being signed in,
    // and bouncing to login would look like the session had expired.
    withAuth(
      { user: { role: "employee" }, loading: false },
      <ProtectedRoute allowedRoles={["super_admin"]}><Secret /></ProtectedRoute>
    )

    expect(screen.getByText("Not allowed")).toBeDefined()
    expect(screen.queryByText("Login page")).toBeNull()
  })

  it("treats an unrecognised role as not permitted", async () => {
    withAuth(
      { user: { role: "contractor" }, loading: false },
      <ProtectedRoute allowedRoles={["employee", "manager", "super_admin"]}><Secret /></ProtectedRoute>
    )
    expect(screen.getByText("Not allowed")).toBeDefined()
  })
})
