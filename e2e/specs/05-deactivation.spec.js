import { test, expect } from "@playwright/test"
import { loginAsNewUser, openTaskDetail, E2E_USERS } from "../fixtures/helpers.js"

// Flow 5 of 5: an admin deactivates someone who still has open work. The dialog must
// force a handover rather than silently stranding the task (Core Rule 2 — soft-delete
// only; Engineering Standards §28 — never orphan a business record on delete), and the
// reassigned task must actually land on the new owner's workload afterward.

const TASK_TITLE = `E2E Handover Task ${Date.now()}`

test("deactivating a user with an open task forces a handover, and the task lands on the new owner", async ({ browser }) => {
  const adminPage = await loginAsNewUser(browser, E2E_USERS.admin)

  // --- Give the peer an open (non-daily) task, so deactivating them requires handover ---
  await adminPage.getByRole("button", { name: "Create Task" }).click()
  await adminPage.getByLabel("Title *").fill(TASK_TITLE)
  await adminPage.getByRole("combobox").filter({ hasText: "Select Assignee" }).click()
  // Not anchored: the option's accessible name includes the avatar's initials text
  // node before the visible name ("EP E2E Peer · 7h free").
  await adminPage.getByRole("option", { name: /E2E Peer/ }).click()
  await adminPage.getByRole("button", { name: "Assign Task", exact: true }).click()
  await expect(adminPage.getByRole("dialog")).toHaveCount(0)

  // --- Organization > Users: deactivate the peer ---
  await adminPage.goto("/super-admin/organization")
  await adminPage.getByRole("tab", { name: "Users" }).click()
  await adminPage.getByRole("button", { name: "Deactivate E2E Peer" }).click()

  await expect(adminPage.getByRole("heading", { name: "Deactivate this person?" })).toBeVisible()
  await expect(adminPage.getByText(/has 1 open task/)).toBeVisible()

  // The confirm button stays disabled until a new owner is chosen — the server-side
  // half of this guard is covered by the backend integration suite; this proves the
  // UI actually enforces it too, not just the API.
  await expect(adminPage.getByRole("button", { name: "Deactivate", exact: true })).toBeDisabled()

  await adminPage.getByRole("combobox").filter({ hasText: "Select a team member" }).click()
  await adminPage.getByRole("option", { name: /E2E Employee/ }).click()
  await adminPage.getByRole("button", { name: "Deactivate", exact: true }).click()
  await expect(adminPage.getByRole("heading", { name: "Deactivate this person?" })).toHaveCount(0)

  // Soft-deleted, not deleted: dropped from the active list GET /api/users returns.
  // Scoped to the table (not the whole page) — the success toast names the deactivated
  // person too ("E2E Peer deactivated — ..."), which would false-positive an unscoped check.
  await expect(adminPage.getByRole("table").getByText("E2E Peer")).toHaveCount(0)

  // --- The handed-over task is now the employee's, with its history intact ---
  // Opening it at all proves the handover: a non-owner gets 403'd by the per-task
  // ownership check, so this task being reachable IS the assertion that assignedTo moved.
  const employeePage = await loginAsNewUser(browser, E2E_USERS.employee)
  await employeePage.getByRole("button", { name: "All time" }).click()
  await openTaskDetail(employeePage, TASK_TITLE)
  await employeePage.getByRole("tab", { name: /Workflow Audit Log/ }).click()
  await expect(employeePage.getByText(/reassign/i)).toBeVisible()
})
