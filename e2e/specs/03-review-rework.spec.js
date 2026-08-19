import { test, expect } from "@playwright/test"
import { loginAsNewUser, openTaskDetail, stepperStep, E2E_USERS } from "../fixtures/helpers.js"

// Flow 3 of 5: a manager assigns work to a report, the report submits it for review,
// and the manager returns it for rework with feedback — the task must land back in the
// employee's active workload (Locked Logic §9: returned work goes back into the
// employee's active workload, not a separate "rejected" bucket).
//
// Two real browser contexts, one per role, so this exercises the same cross-user
// visibility the app enforces in production rather than one tab impersonating both.

const TASK_TITLE = `E2E Review Flow ${Date.now()}`

test("manager assigns, employee submits for review, manager sends it back for rework", async ({ browser }) => {
  const managerPage = await loginAsNewUser(browser, E2E_USERS.manager)
  const employeePage = await loginAsNewUser(browser, E2E_USERS.employee)

  // --- Manager: create a task for the employee ---
  await expect(managerPage).toHaveURL(/\/manager$/)
  await managerPage.getByRole("button", { name: "Create Task" }).click()
  await managerPage.getByLabel("Title *").fill(TASK_TITLE)

  await managerPage.getByRole("combobox").filter({ hasText: "Select Assignee" }).click()
  // Not anchored: the option's accessible name includes the avatar's initials text
  // node before the visible name ("EE E2E Employee · 6h free").
  await managerPage.getByRole("option", { name: /E2E Employee/ }).click()
  await managerPage.getByRole("button", { name: "Assign Task", exact: true }).click()
  await expect(managerPage.getByRole("dialog")).toHaveCount(0)

  // --- Employee: work it through to In Review ---
  // The employee dashboard defaults to scope=today server-side (Locked Logic §7 —
  // daily is the primary view), which would hide a freshly created task that has no
  // due date and hasn't started yet. Switch to "All time" so it's actually on screen.
  await employeePage.reload()
  await employeePage.getByRole("button", { name: "All time" }).click()
  await openTaskDetail(employeePage, TASK_TITLE)
  await expect(employeePage.getByText("Not Started", { exact: true }).first()).toBeVisible()
  await stepperStep(employeePage, "In Progress").click()
  await expect(employeePage.getByText("In Progress", { exact: true }).first()).toBeVisible()
  await stepperStep(employeePage, "In Review").click()
  await expect(employeePage.getByText("In Review", { exact: true }).first()).toBeVisible()

  // --- Manager: open the same task from Team Tasks and send it back with feedback ---
  // scope=all: Team Tasks defaults to "This week", which hides a task with no due date
  // until it becomes actively in-flight — explicit "all" avoids depending on that timing.
  await managerPage.goto("/team-tasks?scope=all")
  await openTaskDetail(managerPage, TASK_TITLE)
  await expect(managerPage.getByText("In Review", { exact: true }).first()).toBeVisible()

  await managerPage.getByLabel("Review Feedback Comments (required)").fill("Please add unit tests before this goes out.")
  await managerPage.getByRole("button", { name: "Send for Rework" }).click()
  await expect(managerPage.getByText("In Progress", { exact: true }).first()).toBeVisible()

  // --- Employee: the task is back in the active workload, not completed or hidden ---
  await employeePage.reload()
  await openTaskDetail(employeePage, TASK_TITLE)
  await expect(employeePage.getByText("In Progress", { exact: true }).first()).toBeVisible()
  await employeePage.getByRole("tab", { name: /Workflow Audit Log/ }).click()
  await expect(employeePage.getByText("Please add unit tests before this goes out.")).toBeVisible()
})
