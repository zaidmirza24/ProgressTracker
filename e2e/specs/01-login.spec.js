import { test, expect } from "@playwright/test"
import { login, E2E_PASSWORD, E2E_USERS } from "../fixtures/helpers.js"

// Flow 1 of 5 (see e2e/README.md): login as each role lands on the correct dashboard
// with the correct sidebar, and a bad password is rejected without landing anywhere.

test.describe("Login and role routing", () => {
  test("super_admin lands on /super-admin with the admin sidebar", async ({ page }) => {
    await login(page, E2E_USERS.admin)
    await expect(page).toHaveURL(/\/super-admin$/)

    for (const label of ["Overview", "My Work", "My Progress", "Team Tasks", "Organization", "Reports & Analytics", "Work Logs"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible()
    }
    // Role-specific links that must NOT leak onto other roles' sidebars.
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0)
  })

  test("manager lands on /manager with the manager sidebar", async ({ page }) => {
    await login(page, E2E_USERS.manager)
    await expect(page).toHaveURL(/\/manager$/)

    for (const label of ["Dashboard", "My Work", "My Progress", "Team Tasks", "Work Logs"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible()
    }
    await expect(page.getByRole("link", { name: "Organization" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "Reports & Analytics" })).toHaveCount(0)
  })

  test("employee lands on /employee with the employee sidebar", async ({ page }) => {
    await login(page, E2E_USERS.employee)
    await expect(page).toHaveURL(/\/employee$/)

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible()
    await expect(page.getByRole("link", { name: "My Progress" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Work Log", exact: true })).toBeVisible()
    // Manager/admin-only surfaces must not be reachable from the employee sidebar.
    await expect(page.getByRole("link", { name: "Team Tasks" })).toHaveCount(0)
    await expect(page.getByRole("link", { name: "My Work" })).toHaveCount(0)
  })

  test("logout returns to the login page and protects the dashboard again", async ({ page }) => {
    await login(page, E2E_USERS.employee)
    await expect(page).toHaveURL(/\/employee$/)

    await page.getByRole("button", { name: "Logout" }).click()
    await expect(page).toHaveURL(/\/login$/)

    // Direct navigation to a protected route with no session bounces back to login.
    await page.goto("/employee")
    await expect(page).toHaveURL(/\/login$/)
  })

  test("wrong password is rejected and stays on the login page", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Email Address").fill(E2E_USERS.employee)
    await page.getByLabel("Password").fill("definitely-not-the-password")
    await page.getByRole("button", { name: "Sign In" }).click()

    await expect(page.locator(".text-destructive")).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)

    // The account is still usable with the real password right after a failed attempt.
    await page.getByLabel("Password").fill(E2E_PASSWORD)
    await page.getByRole("button", { name: "Sign In" }).click()
    await expect(page).toHaveURL(/\/employee$/)
  })
})
