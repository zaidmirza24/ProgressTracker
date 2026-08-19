import { test, expect } from "@playwright/test"
import { loginAsNewUser, openTaskDetail, E2E_USERS } from "../fixtures/helpers.js"

// Flow 4 of 5: a manager flags a task as blocked, the assignee sees it, and starting
// the timer on it auto-unblocks — the Iteration 13 regression this app locks in at the
// integration-test level, exercised here purely through the UI two different people
// actually see.
//
// Blocked is deliberately independent of status (BlockedPanel.jsx) — a task sitting at
// "Not Started" with no due date can still be blocked, and being blocked is what keeps
// it visible under the employee dashboard's default "today" scope even though nothing
// else about the task would otherwise put it there.

const TASK_TITLE = `E2E Blocked Flow ${Date.now()}`
const BLOCK_REASON = "Waiting on API credentials from IT"

test("manager blocks a task, employee sees it, starting the timer clears it", async ({ browser }) => {
  const managerPage = await loginAsNewUser(browser, E2E_USERS.manager)
  const employeePage = await loginAsNewUser(browser, E2E_USERS.employee)

  // --- Manager: create the task ---
  await managerPage.getByRole("button", { name: "Create Task" }).click()
  await managerPage.getByLabel("Title *").fill(TASK_TITLE)
  await managerPage.getByRole("combobox").filter({ hasText: "Select Assignee" }).click()
  // Not anchored: the option's accessible name includes the avatar's initials text
  // node before the visible name ("EE E2E Employee · 6h free").
  await managerPage.getByRole("option", { name: /E2E Employee/ }).click()
  await managerPage.getByRole("button", { name: "Assign Task", exact: true }).click()
  await expect(managerPage.getByRole("dialog")).toHaveCount(0)

  // --- Manager: mark it blocked ---
  // scope=all: same reason as the review/rework flow — a fresh, not-yet-blocked, no-due
  // -date task doesn't fall in "This week" by default.
  await managerPage.goto("/team-tasks?scope=all")
  await openTaskDetail(managerPage, TASK_TITLE)
  await managerPage.getByRole("button", { name: "Mark blocked" }).click()
  await managerPage.getByLabel("Reason (required)").fill(BLOCK_REASON)
  await managerPage.getByRole("button", { name: "Mark blocked" }).click()
  await expect(managerPage.getByRole("heading", { name: "Blocked", exact: true })).toBeVisible()
  // .first(): the reason renders twice at once — the info-grid badge line and the
  // BlockedPanel's own quoted paragraph.
  await expect(managerPage.getByText(BLOCK_REASON).first()).toBeVisible()

  // --- Employee: sees the blocked badge without changing scope (a blocked task is
  // always in scope, per Frontend/src/lib/taskScope.js's "waiting on attention" clause) ---
  await employeePage.reload()
  await openTaskDetail(employeePage, TASK_TITLE)
  await expect(employeePage.getByText("⛔", { exact: false })).toBeVisible()
  await expect(employeePage.getByRole("heading", { name: "Blocked", exact: true })).toBeVisible()
  await expect(employeePage.getByText(BLOCK_REASON).first()).toBeVisible()

  // --- Employee: starting the timer auto-unblocks (Iteration 13) ---
  await employeePage.getByRole("button", { name: "Start Timer" }).click()
  await expect(employeePage.getByRole("dialog").getByRole("button", { name: "Pause", exact: true })).toBeVisible()

  // Confirm against the server record, not just the optimistic timer UI — the blocked
  // flag lives on the task itself and this dashboard has no live polling for it.
  await employeePage.reload()
  await openTaskDetail(employeePage, TASK_TITLE)
  await expect(employeePage.getByRole("heading", { name: "Blocked", exact: true })).toHaveCount(0)
  await expect(employeePage.getByText("Waiting on something?")).toBeVisible()
})
