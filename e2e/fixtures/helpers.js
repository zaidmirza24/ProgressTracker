import { expect } from "@playwright/test"
import { E2E_PASSWORD, E2E_USERS } from "../../Backend/tests/e2e/seedE2E.js"

export { E2E_PASSWORD, E2E_USERS }

// Login via the real form — no localStorage/token shortcuts, so the flow this test
// exists to prove ("does login actually work end to end") is the thing that runs.
export const login = async (page, email) => {
  await page.goto("/login")
  await page.getByLabel("Email Address").fill(email)
  await page.getByLabel("Password").fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Sign In" }).click()
}

// A fresh, isolated browser context logged in as one user — the right tool whenever a
// flow needs two people (e.g. a manager and the employee they assigned work to) acting
// at once, since sharing one page across roles would mean logging out and back in and
// risks state bleeding between "users" that are really the same tab.
export const loginAsNewUser = async (browser, email) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await login(page, email)
  return page
}

// The workflow stepper's step circles carry no accessible name (TaskDetailModalCore) —
// only the label span beside them does. Locate the button by that label instead of
// relying on nth-child position or Tailwind class strings, either of which breaks the
// moment the layout changes. Scoped to the open dialog, not the whole document — an
// unscoped search risks matching an unrelated span/button pair anywhere else on the page.
export const stepperStep = (page, label) =>
  page.getByRole("dialog").locator(`xpath=.//span[normalize-space(text())="${label}"]/preceding-sibling::button`)

// Opens a task's detail modal from any list/board/card view — every surface renders the
// title through the same shared OpenDetailButton component. `.first()` is deliberate: a
// daily task can legitimately render twice on the employee dashboard (once in "Today's
// Daily Tasks", once again in "My Assigned Tasks" below it) — both open the same
// underlying task, so either one is a correct place to click.
export const openTaskDetail = async (page, title) => {
  await page.getByRole("button", { name: title, exact: true }).first().click()
  await expect(page.getByRole("heading", { name: title })).toBeVisible()
}

export const closeDialog = async (page) => {
  await page.keyboard.press("Escape")
}
