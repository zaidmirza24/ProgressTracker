import { test, expect } from "@playwright/test"
import { login, openTaskDetail, stepperStep, E2E_USERS } from "../fixtures/helpers.js"

// Flow 2 of 5: start the timer on a daily task, watch the widget tick, pause, resume,
// then complete it — the completed task must show a non-zero tracked time, proving the
// timer's server-side accounting actually reached the task record (Core Rule 1: timer
// events are computed server-side, never trusted from the client).
//
// "E2E Daily Standup" is provisioned automatically for every active employee from the
// global TaskTemplate the seed fixture creates (see Backend/tests/e2e/seedE2E.js) —
// provisioning runs on the employee's first `/api/tasks/daily` request, i.e. on load.

const DAILY_TASK = "E2E Daily Standup"

test("employee tracks time on a daily task through to completion", async ({ page }) => {
  await login(page, E2E_USERS.employee)
  await expect(page).toHaveURL(/\/employee$/)

  await openTaskDetail(page, DAILY_TASK)
  await expect(page.getByText("Not Started", { exact: true }).first()).toBeVisible()

  // Start — this both opens a WorkSession and, per the locked workflow, flips the task
  // to In Progress automatically (timer state drives status, not the other way round).
  await page.getByRole("button", { name: "Start Timer" }).click()
  // Scoped to the open dialog — the sidebar's own live-timer widget (Layout.jsx) also
  // renders a MM:SS clock in the same font-mono style once a session is active, and an
  // unscoped locator here would match both and fail Playwright's strict-mode check.
  const clock = page.getByRole("dialog").locator("span.font-mono").filter({ hasText: /^\d{2}:\d{2}$/ })
  await expect(clock).toBeVisible()
  const firstReading = await clock.textContent()

  // Prove the widget is actually ticking, not a static "00:00" — poll rather than a
  // fixed sleep so this doesn't hardcode a specific interval.
  await expect(async () => {
    const reading = await clock.textContent()
    expect(reading).not.toBe(firstReading)
  }).toPass({ timeout: 5000 })

  // Pause / Resume — both round trips the locked workflow calls out explicitly.
  await page.getByRole("button", { name: "Pause", exact: true }).click()
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible()
  await page.getByRole("button", { name: "Resume" }).click()
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible()

  // Let a little more real time accrue before completing, so the tracked-time
  // assertion below has something non-zero to find.
  await page.waitForTimeout(2000)

  // Self-created (daily) work skips review — In Progress -> Completed directly, and the
  // server auto-stops the running session as part of that transition (retaining its
  // elapsed time rather than leaving the task locked with a timer still attached to it).
  //
  // Asserting the tracked-time NUMBER off the actual PATCH response, rather than the
  // rendered "Xm" text, is deliberate: formatTrackedTime floors to whole minutes, and a
  // real E2E run only accrues a few real seconds here — waiting 60s just to see the UI
  // text change minutes would make this the slowest thing in the whole suite for no
  // extra confidence. The UI wiring for that display is unit-tested separately.
  const [statusResponse] = await Promise.all([
    page.waitForResponse(res => res.url().includes("/status") && res.request().method() === "PUT"),
    stepperStep(page, "Completed").click()
  ])
  const { task: completedTask } = await statusResponse.json()
  expect(completedTask.status).toBe("Completed")
  expect(completedTask.totalTrackedSeconds).toBeGreaterThan(0)

  await expect(page.getByRole("heading", { name: DAILY_TASK })).toBeVisible()
  await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Time Tracked:")).toBeVisible()

  // The timer panel itself disappears once a task is Completed (locked record, §4).
  await expect(page.getByRole("button", { name: "Start Timer" })).toHaveCount(0)
})
