# Frontend UI/UX Audit — Full Product Experience (2026-08-18)

Scope: the entire `Frontend/src` tree (102 files, ~12.5k lines) — every route, page, dashboard,
component, modal, table, form, store, context, and the design-token layer in `index.css`.
Audited by tracing whole workflows (login → find work → track time → submit → review → report),
not screen-by-screen in isolation.

**Status:** findings below are as-audited. Fixes are being applied in slices; see the changelog at the
foot of this document for what has landed.

---

## A. Overall UX Score

| Dimension | Score | One-line verdict |
|---|---|---|
| Information Architecture | **6.5** / 10 | Role split is correct and deliberate; page boundaries blur and labels drift |
| Navigation | **6.0** / 10 | Flat, unGrouped link list; the same destination is named three different things |
| Dashboard UX | **5.5** / 10 | Manager Overview is ten stacked full-width sections with no hierarchy above them |
| Task UX | **8.0** / 10 | The strongest part of the product — genuinely well-designed |
| Forms | **7.5** / 10 | Good prefill, good inline capacity warnings, good preserve-on-error |
| Tables | **6.0** / 10 | Readable, but zero sorting and zero pagination anywhere in the app |
| Visual hierarchy | **6.0** / 10 | Everything is a card at the same visual weight; badge noise on task rows |
| Consistency | **5.5** / 10 | A real design system exists but is bypassed in 106 places, and is partly broken |
| Accessibility | **3.5** / 10 | Primary interaction is unreachable by keyboard; zero focus management |
| Responsive design | **6.0** / 10 | Shell is genuinely responsive; content is desktop-shaped and merely shrinks |
| Feedback / error handling | **7.5** / 10 | Global interceptor + optimistic-with-rollback is a strong, consistent foundation |
| **Overall usability** | **6.5** / 10 | A capable, thoughtfully-reasoned product with a broken visual layer on top |

**Headline:** the *thinking* in this frontend is well above average — the Locked Logic constraints are
respected consistently, metrics carry their denominators, empty states explain themselves, and
"signal not verdict" framing is applied everywhere it should be. The weaknesses are almost entirely
in the **presentation layer** (a design system that is defined but not enforced, and partly
non-functional) and in **accessibility** (essentially unaddressed). Those are cheaper to fix than
architectural problems would be.

---

## B. Critical Issues

These cause visible breakage or actively mislead. Fix before anything else.

### C1 — `badge-violet` is used 7 times and never defined

`components/ui/badge.jsx:24` maps `variant="violet"` to the class `badge-violet`. That class does not
exist in `index.css` (only `badge-success`, `badge-warning`, `badge-info`, and an unused `badge-teal`
are defined). Every violet badge therefore renders with **no background and no text color** — just the
base `border` from `badgeVariants`, inheriting whatever color surrounds it.

Affected: the "Self" badge on tasks, the "Daily" badge in `DailyTasksSection`, the sidebar role chip
for Super Admin, the "Now in production" chip on Login, and the "By: {name}" chip in the work-log
detail dialog.

*Why it matters:* "Self-assigned" vs "manager-assigned" is a workflow-relevant distinction (it changes
whether a task routes through review). It currently reads as an unstyled artifact.

### C2 — Status badges are only styled for dark theme

`index.css:211–231` defines `.badge-success` / `.badge-warning` / `.badge-info` **once**, with
lightness values tuned for a dark surface (e.g. warning is `oklch(0.820 0.160 72)` — a pale amber on a
20%-alpha fill). There is no `:root`/light-theme override. Light mode is a first-class, one-click
toggle (sidebar footer and login page), and status badges are the product's primary visual language —
`STATUS_VARIANTS` maps every one of the five workflow states onto them.

Result: a user who switches to light mode gets pale-on-white status badges across every task list,
kanban card, table row, and detail modal. Contrast is roughly 1.6–2.1:1 — far below the 4.5:1 minimum.

Mitigating factor only: `ThemeContext` defaults to `"dark"`, so this is opt-in breakage rather than
default breakage.

### C3 — The entire semantic color scale was never registered, and 6 usages misuse it

**Understated on first pass; corrected after verifying against a build.** `--success`, `--warning`
and `--info` were defined as raw custom properties in `:root`/`.dark`, but never added to the
`@theme inline` block as `--color-*` keys. Tailwind v4 only generates color utilities from registered
theme keys, so **all 32 semantic utility usages in the app compiled to nothing** — `bg-warning/5`,
`text-warning`, `border-info/25`, `border-warning/30` and friends produced no CSS at all.

Verified empirically by building both revisions: at baseline, `.text-warning*`, `.bg-warning*`,
`.border-warning*` and `.text-info*` each generated **0 rules**.

This is almost certainly the root cause of finding G's 106 raw palette colors — the semantic classes
silently did nothing, so components reached for `text-amber-400` instead.

On top of that, six places use `*-foreground` tokens as standalone text colors. Those tokens are
defined as *text-on-that-color* pairs (near-black and near-white), so once the scale is registered
they render inverted:

`--warning-foreground` and `--info-foreground` are defined as *text-on-that-color* pairs — near-black
and near-white respectively. Six places use them as plain text colors on a **card** background, which
inverts their meaning:

| Location | Token | Breaks in |
|---|---|---|
| `TeamCommandCenter.jsx:163` — "Pending Review" count | `text-warning-foreground` (near-black) | **dark** — dark text on dark card |
| `TeamWorkloadTracker.jsx:218` — "Review" count | `text-warning-foreground` | **dark** |
| `AttentionZone.jsx:21` — warning attention chips | `text-warning-foreground` | **dark** |
| `NeedsAttentionStrip.jsx:45` — "over estimate" chip | `text-warning-foreground` | **dark** |
| `ReportsTab.jsx:154` — pattern attention chip | `text-warning-foreground` | **dark** |
| `MyWorkPanel.jsx:284` — "Today's Tracked Time" value | `text-info-foreground` (near-white) | **light** |

The Manager dashboard's *"how many tasks are waiting for me to review"* number — arguably the single
most important number on that page — is one of these.

### C4 — "Pending Backlog" panel mixes two different backlogs

`MyProgress.jsx:134–147` and `EmployeeDrilldownModal.jsx:111–125` both render a card titled **Pending
Backlog** whose three rows come from three different sources:

- *Tasks Pending* → `report.pending` — the **paused** count (timer off)
- *Avg. Age* → `report.blockedBacklogAvgAgeDays` — the **blocked** backlog's age
- *Oldest* → `report.pendingBacklogOldestAgeDays` — the **pending** backlog's age

So a user reading "3 tasks pending, avg. age 6 days" is seeing a count of paused tasks next to the
average age of an entirely different (blocked) set. The rest of the app is careful about exactly this
distinction — `taskConstants.js` renames the stored `Pending` status to the display label **"Paused"**
precisely because "paused ≠ stuck", and `TeamSignalsPanel` correctly splits them into separate
`Deadline` and `Blocked` blocks. These two panels missed the split.

Violates Locked Logic §8 and Engineering Standards §14 / §41.

### C5 — The product's primary interaction is not reachable by keyboard

There is **not one** `tabIndex`, `onKeyDown`, or `onKeyPress` in the entire frontend. "Open task
detail" — the gateway to comments, history, the timer panel, approve/rework, and block — is a bare
`onClick` on a non-interactive element in every surface that offers it:

- `TaskListView.jsx:86` — `<motion.tr onClick>`
- `TeamTasksTable.jsx:163` — `<motion.tr onClick>`
- `TaskKanbanBoard.jsx:138` — `<motion.div onClick>`
- `DailyTasksSection.jsx:55` — `<div onClick>`
- `TeamWorkloadTracker.jsx:234` — `<div onClick>`
- `EmployeesReport.jsx:27` — `<TableRow onClick>`
- `WorkLogs.jsx:277` — `<TableRow onClick>`

A keyboard or screen-reader user can reach the row's *action menu* (a real `<button>`) but cannot open
the row itself. Related: `sr-only` appears exactly once in the codebase (Radix's own dialog close
button), and `aria-*` appears 9 times total across 102 files.

---

## C. High Priority Issues

### H1 — Manager/Admin "Overview" is ten stacked full-width sections

`TeamCommandCenter` renders, in order: page header → AttentionZone → ActiveWorkStrip → 4 metric cards →
PendingReviewQueue → TeamWorkloadTracker → TeamSignalsPanel → TeamCapacityForecast → WorkLogsSection.
Super Admin gets an OrgPulseStrip on top of that. Nothing is collapsed, nothing is behind a tab,
everything is the same visual weight, and the page is several screens tall.

The `AttentionZone` at the top is the right instinct and is well built — but it links *down* into a
wall rather than replacing it. Locked Logic §40 and Standard §39 both ask for progressive disclosure
here.

### H2 — No table has sorting or pagination

Every table in the app renders its full result set: `TeamTasksTable`, `TaskListView`, `UsersTab`,
`DepartmentsTab`, `TeamsTab`, `EmployeesReport`, `EntityReportTable`, `WorkLogs`, and
`WorkLogsSection` (which hard-slices to 10 with a `{min(n,10)} of {n}` badge and a "View All" link —
the only place that acknowledges the problem). At 10 people this is survivable. `WorkLogs` grows by
one row per person per working day and is the first that will break — roughly 200 rows/month.

`EmployeesReport` in particular is a decision-making table (manager compares people) with no way to
sort by completion rate, overdue count, or tracked hours.

### H3 — The same destination has three different names

| Surface | Employee | Manager | Super Admin |
|---|---|---|---|
| Sidebar label for own-work page | "Dashboard" | "My Work" | "My Work" |
| Page `<h2>` on that page | "My Workspace" | "My Workspace" | "My Workspace" |
| Sidebar label for team page | — | "Dashboard" | "Overview" |
| Page `<h2>` on team page | — | "Manager Dashboard" | "Super Admin Center" |
| Work-log link | "Work Log" | "Work Logs" | "Work Logs" |

`MyWorkPage` and `EmployeeDashboard` render the *identical* `MyWorkPanel` component, yet one is called
"Dashboard" and the other "My Work". Meanwhile "Dashboard" means the *team* page for a manager and the
*personal* page for an employee — the exact confusion the Manager = "My Work + My Team" model is
supposed to eliminate.

### H4 — "Team Tasks" and "Overview" overlap without a clear division of labour

`TeamTasksPage` shows every team task in a filterable/scopeable table. `TeamCommandCenter`'s
`TeamWorkloadTracker` shows the same tasks grouped per employee, and `PendingReviewQueue` shows a
subset again. A manager asking "where do I go to see Priya's overdue task?" has three valid answers.
`AttentionZone` itself is inconsistent about this — it *scrolls* to review/workload/signals but
*navigates* to `/team-tasks` for overdue and blocked.

### H5 — One native `confirm()` remains

`TaskTemplatesTab.jsx:232` — `confirm("Are you sure you want to delete this template?")`. Every other
destructive action in the app uses a proper themed dialog with a required reason and consequence
preview (`CancelTaskDialog`, `DeactivateUserDialog`). Deleting a template is arguably *more*
consequential than cancelling one task — it stops daily provisioning for everyone in scope — and it
gets the weakest confirmation in the product, with no statement of what happens to existing instances.

### H6 — Two implementations of the same tab pattern

`OrganizationPage` uses real Radix `Tabs` (underline style, keyboard arrow navigation, correct
`role="tablist"` semantics). `ReportsTab` implements its five sub-tabs as a row of `<Button>` pills
driven by `activeSubTab` in a Zustand store — no tab semantics, no arrow-key navigation, and the
active tab is not announced. `TaskDetailModalCore` uses Radix Tabs in a third visual style (filled
pills). Three looks, two behaviours, one concept.

### H7 — Stale microcopy referencing a status that no longer exists

The `Approved` status was removed in Iteration 6, but copy still references it:

- `MyWorkPanel.jsx:272` — *"All-time · marked completed or approved"*
- `TeamCommandCenter.jsx:190` — *"All-time · approved and locked work items"*

Both are also wrong about "all-time": `MyWorkPanel`'s completed count is derived from `tasks`, which
is server-scoped to the selected scope (defaulting to **today**). The card says "All-time" while
showing today's number. The adjacent line in the same card gets it right (`scope === "all" ? … : …`) —
this one branch was missed.

### H8 — Search filters the list but not the count

`MyWorkPanel.jsx:338–340` renders the count badge from `tasks.length` while the list below renders
`filteredTasks`. Type a search term and the badge keeps claiming the unfiltered total.
`TeamTasksTable` handles the equivalent case correctly with an explicit `{filtered} of {total}` chip —
worth copying.

### H9 — Full data refetch on every navigation between Overview and Team Tasks

`TeamCommandCenter` and `TeamTasksPage` each call `loadData(userId, role)` on mount, which fires
`/api/tasks`, `/api/users`, `/api/departments`, `/api/tasks/report` in parallel and then
`/api/daily-work-logs` sequentially. `useManagerDashboardStore` has no staleness guard, so bouncing
between the two pages re-runs all five requests every time. Worse, `loading` is set `false` after the
first load and never set back to `true`, so the refetch is invisible — the user sees stale data with
no indication that it is being replaced, then a silent jump.

### H10 — Role→home-route mapping is duplicated in three places

`App.jsx:22–29` (`HomeRedirect`), `MyProgress.jsx:49` (`dashboardHome`), and
`Unauthorized.jsx:11–17` each independently hardcode `super_admin → /super-admin`, `manager →
/manager`, else `/employee`. Adding a role or renaming a route requires finding all three
(Standard §27).

---

## D. Medium Priority Issues

- **M1 — Scope changes give no loading feedback.** `useEmployeeDashboardStore.loading` is initialised
  `true` and only ever set `false`. Switching Today → This week → All time refires the request with
  no spinner, no skeleton, no disabled state; the list just changes when it changes.

- **M2 — Kanban is unusable on mobile.** `TaskKanbanBoard` is `grid-cols-1 md:grid-cols-2
  lg:grid-cols-5`, and each column has `min-h-[350px]`. On a phone that is five stacked 350px columns —
  ~1,750px of mostly-empty vertical scroll — and Board is the **default** view mode. List view should
  be the mobile default, or the board should collapse to the non-empty columns.

- **M3 — Capacity forecast detail is tooltip-only.** `TeamCapacityForecast` puts the actual numbers
  (`"6h planned / 7h capacity"`, `"Holiday — but 4h is scheduled"`) in a `title` attribute. Not
  reachable by keyboard, not available on touch, and not announced. The visible cell is a bare `6h`
  plus a background shade.

- **M4 — Two navigation models inside one component.** `AttentionZone` mixes
  `scrollIntoView` (review, workload, signals) with `navigate()` (overdue, blocked). Clicking two
  adjacent chips does two categorically different things with no visual distinction.

- **M5 — `TeamTasksTable`'s card has a toolbar and no title.** Its `CardHeader` is
  `sm:justify-end` with only search/scope/filter/count. Iteration 14 removed a duplicated title and
  left a headerless card floating under the page `<h2>`.

- **M6 — Report tables have no empty state.** `EmployeesReport` and `EntityReportTable` map straight
  over their arrays with no `length === 0` branch. A new organisation, or a filtered range with no
  data, renders a header row over blank space — while every task table in the app has a well-written
  empty state (Standard §15).

- **M7 — Non-functional affordances on Login.** "Forgot password?" (`Login.jsx:261`) and "Privacy
  Policy" (`:167`) are styled as interactive links with hover states and `cursor-pointer`, and do
  nothing. Failing to sign in is exactly when a user reaches for the first one.

- **M8 — Demo credentials ship in the login page.** `Login.jsx:330–333` hardcodes three working
  accounts with plaintext passwords behind a "Quick Demo Access" expander. Flagged as deferred in
  Iteration 14; restating because the app is in production use.

- **M9 — Work-log double-submission is discovered too late.** `WorkLogs.openCreate` opens the dialog,
  *then* fetches `today-context`, and if `alreadySubmitted` is true it closes the dialog again and
  fires a toast. The user sees a modal flash open and shut. The page itself never shows today's
  submission status — the manager's `WorkLogsSection` does, but the employee's own page doesn't.

- **M10 — Overdue is signalled with an emoji.** `TaskListView.jsx:145` and `TeamTasksTable.jsx:222`
  prefix the due date with a literal `"⚠️ "` string, while every other state signal in the app uses a
  lucide icon component. Renders inconsistently across platforms and doesn't inherit color or size.

- **M11 — Comments are a single-line input.** `TaskDetailModalCore.jsx:241` uses `<Input>` for the
  comment box, though comments are the *only* communication channel in the product (explicit product
  decision — no messaging system). No multi-line, no character counter, no edit, no delete. The
  rework-feedback textarea in `PendingReviewQueue` gets a proper `<textarea>`; the general discussion
  thread doesn't.

- **M12 — Comment timestamps have no time.** `TaskDetailModalCore.jsx:228` renders
  `toLocaleDateString()` only. Multiple comments on one day are indistinguishable in ordering. The
  adjacent history tab (`:274`) formats date *and* time correctly.

- **M13 — Deactivation candidate list excludes managers.** `DeactivateUserDialog` filters handover
  candidates to `role === "employee"`, but Iteration 15 established that managers and admins carry
  their own work. A manager cannot be handed a departing employee's tasks.

---

## E. Low Priority / Polish

- **L1** — `.badge-teal` is defined in `index.css:226` and never used. Dead CSS.
- **L2** — `"v1.0.0"` is hardcoded in the sidebar brand block (`Layout.jsx:92`).
- **L3** — Search inputs use a `"🔍 "` emoji inside the placeholder (`MyWorkPanel`, `TeamTasksTable`)
  while `TaskTemplatesTab` does it properly with a positioned `<Search>` icon. Two patterns.
- **L4** — `"➔ "` glyph prefixes transition options inside `<Select>` items in three files.
- **L5** — Emoji inside `<SelectItem>` values: `👤🔷👑` for roles (`UsersTab`, `OnboardingWizard`),
  `📁⚡📅🗓️⚙️` for timeframes (`ReportsTab`). Inconsistent with the icon system used everywhere else.
- **L6** — Progress bars are `hidden sm:block`; on mobile only the bare `%` survives, with no label.
- **L7** — Toasts are fixed 5s with no pause-on-hover and no action slot (no "Undo" on cancel/
  reassign, both of which are reversible-ish and currently irreversible from the UI).
- **L8** — `.card-hover:hover` uses a fixed `oklch(0 0 0 / 45%)` shadow — tuned for dark, heavy in light.
- **L9** — `motion` `layout` animations on every table row (`TaskListView`, `TeamTasksTable`) run a
  spring per row on every list change. Fine at 10 people; the first thing to reconsider at scale.

---

## F. Screen-by-Screen Findings

### Login (`pages/Login.jsx`)
- **Works:** genuinely polished; the split hero/form layout collapses correctly at `lg`; password
  visibility toggle; error region is animated and near the form; theme toggle available pre-auth.
- **Confusing:** two dead links (M7); "Quick Demo Access" is prominent on a production login.
- **Missing:** no rate-limit or lockout feedback; no caps-lock hint; the submit button stays disabled
  during `submitting` but the form fields remain editable.
- **Change:** remove or wire the dead links; gate the seeder behind a dev flag. *Why:* a dead
  "Forgot password?" on a failed login is the worst possible moment for a no-op.

### Employee Dashboard / My Work (`MyWorkPanel.jsx`)
- **Works:** this is the best screen in the product. `NeedsAttentionStrip` answers "what's wrong?"
  first; `DailyTasksSection` separates new vs carried-forward as Locked Logic §8 requires; the four
  metric cards are labelled with their denominators; Board/List toggle; scope toggle; per-row timer
  controls with pending spinners; `MyProgressSection` framed explicitly as non-punitive.
- **Confusing:** the count badge ignores search (H8); "Completed Tasks" says all-time but is scoped
  (H7); "My Assigned Tasks" is the section title but the list also contains self-created tasks.
- **Missing:** no sort; no filter by status/priority (search is title/category/priority substring
  only); no bulk action; no indication that the default scope is "today" other than the toggle state.
- **Change:** fix the count, fix the copy, make List the mobile default. *Why:* the scoped-vs-all-time
  mismatch means a user reading the card gets a wrong number with a confident label.

### Manager Dashboard / Super Admin Overview (`TeamCommandCenter.jsx`)
- **Works:** `AttentionZone` is the right pattern, well executed, with a real empty state.
  `ActiveWorkStrip` reads live session state rather than stale task status — a genuinely good
  distinction. `PendingReviewQueue` allows inline approve and requires a reason for rework.
  `TeamWorkloadTracker` sorts by largest estimate when someone is over capacity, which is exactly the
  manager's next question.
- **Confusing:** ten stacked sections (H1); "Pending Review" count may be invisible (C3); "In
  Progress" card footnote silently merges a second metric (`· N paused`); `TeamCapacityForecast` is
  labelled "Preview" with no explanation of what that means for trust.
- **Missing:** no way to collapse or reorder sections; no date context on the whole page (everything
  is "today" or "all-time" with no shared control); no bulk reassign despite reassign being a
  first-class action.
- **Change:** collapse `TeamSignalsPanel`, `TeamCapacityForecast`, and `WorkLogsSection` behind
  tabs or accordions under the workload tracker. *Why:* Locked Logic §40 — the dashboard should answer
  "what needs my attention", and it currently answers it in the first 200px then keeps talking.

### Team Tasks (`TeamTasksPage.jsx` + `TeamTasksTable.jsx`)
- **Works:** filter and scope live in the URL — shareable, bookmarkable, deep-linkable from
  `AttentionZone`. Active-filter chip shows the count and clears in one click. Excellent empty states
  that branch on search vs filter vs scope. Inline status dropdown that correctly defers to the modal
  when review feedback is required.
- **Confusing:** headerless card (M5); overlap with Overview (H4); seven columns plus up to five
  inline badges on the title makes the Task column visually noisy.
- **Missing:** sorting; pagination; a filter for priority or assignee (search covers assignee by
  substring only); no column for estimated vs actual despite that being a headline product concept.
- **Change:** give the card a title and add sort on Due Date / Priority / Assignee. *Why:* this is
  the manager's list view of record and currently offers no ordering control at all.

### My Progress (`pages/MyProgress.jsx`)
- **Works:** two-column layout with a sticky right rail is the right shape. Retry-on-error state is
  properly distinct from empty and loading. The estimation-pattern card shows the specific underlying
  tasks, not just a percentage (Locked Logic §10). Copy is consistently non-punitive.
- **Confusing:** the "Pending Backlog" card is wrong (C4).
- **Missing:** no trend over time anywhere — every number is a current snapshot, so "am I improving?"
  is unanswerable. No date range control.
- **Change:** fix C4 first. *Why:* it is a labelled metric showing a number from a different metric.

### Work Logs (`pages/WorkLogs.jsx`)
- **Works:** the prefill is excellent — hours come from the timer, tasks come from what was actually
  completed, and the variance hint ("your timer recorded 6h — that's 2h different") is exactly the
  right kind of nudge. Employee/manager views share one page cleanly.
- **Confusing:** the already-submitted flow flashes the dialog open and closed (M9).
- **Missing:** pagination and date filtering (flagged deferred in Iteration 14, still open); no edit
  after submission; no export; the employee's own page never shows whether today is done.
- **Change:** surface today's submission status on the page, before the button. *Why:* the manager's
  compliance strip already computes this — the person who needs it most doesn't see it.

### Organization (`OrganizationPage.jsx` + 5 tabs)
- **Works:** correct instinct to split set-up-once config from daily operations. `OnboardingWizard`'s
  inline department/team creation avoids a dead end. `DeactivateUserDialog`'s forced handover is a
  genuinely thoughtful piece of design. `WorkCalendarTab` explains its own blast radius up front and
  only enables Save when dirty.
- **Confusing:** template deletion uses `confirm()` (H5); `UsersTab` shows Daily Working Hours only
  when `role === "employee"` although managers/admins now carry work and have capacity too.
- **Missing:** no user search or filter in `UsersTab`; no way to reactivate a deactivated user (they
  vanish from the list entirely); template cards don't say how many task instances exist.
- **Change:** replace the `confirm()` and state what happens to already-provisioned instances. *Why:*
  it is the most consequential delete in the app with the weakest confirmation.

### Reports & Analytics (`ReportsTab.jsx` + 5 sub-reports)
- **Works:** timeframe control with an explicit "Showing: Last 7 Days" chip; the Overdue card
  correctly warns that it is *not* scoped to the range; error-with-retry state; `EmployeeDrilldownModal`
  is thorough and always traces a flag back to specific tasks.
- **Confusing:** sub-tabs are buttons, not tabs (H6); `EmployeesReport` shows `completionRate` while
  the drilldown shows `overallCompletionRate` labelled "(derived)" — same number, two names.
- **Missing:** empty states (M6); sorting (H2); export; any time-series view at all — `AnalyticsReport`
  has a status donut and a department bar chart, both point-in-time.
- **Change:** convert the pills to real Tabs and add empty states. *Why:* consistency with
  `OrganizationPage`, and a report table over a filtered-to-nothing range currently renders blank.

### Task Detail Modal (`TaskDetailModalCore.jsx` + role wrappers)
- **Works:** the shared-core / role-wrapper split is good architecture. The workflow stepper is the
  clearest status affordance in the product. Info grid carries est/actual/variance with explanations,
  not bare numbers. Discussion and Workflow Audit Log as sibling tabs is right. `BlockedPanel`'s
  paused-vs-blocked framing is excellent and is the app's best piece of microcopy.
- **Confusing:** on a manager's In-Review task, three action panels can stack (`ApprovalGatingPanel`,
  `BlockedPanel`, `TaskAdminPanel`) between the description and the tabs, pushing the discussion
  below the fold in a `max-h-[85vh]` modal.
- **Missing:** no link from the modal to the assignee's workload; no way to edit a comment; no
  attachment (explicitly deferred — correct).
- **Change:** collapse `TaskAdminPanel` into an overflow menu in the modal header. *Why:* the primary
  action on an In-Review task is approve/rework, and it currently competes with two other panels.

---

## G. Component-Level Findings

**Patterns that should be standardised (each currently has 2–3 implementations):**

| Pattern | Implementations found | Recommendation |
|---|---|---|
| Tabs | Radix underline (`OrganizationPage`), Button pills (`ReportsTab`), Radix filled pills (`TaskDetailModalCore`) | One `Tabs` component, two documented variants |
| Search field | Emoji-in-placeholder (`MyWorkPanel`, `TeamTasksTable`) vs icon adornment (`TaskTemplatesTab`) | One `SearchInput` with the icon adornment |
| Segmented control | `ScopeToggle` and the Board/List switch are visually identical but separately implemented (`MyWorkPanel.jsx:313–336`) | Extract the `ScopeToggle` shell into a shared `SegmentedControl` |
| Stat tile | `MyProgressSection.Stat`, `MyProgress.Stat`, `MyProgress.RateBlock`, `EmployeeDrilldownModal`'s inline divs, `TeamSignalsPanel.Row` | One `Stat` primitive with `value`/`label`/`sub`/`bar` props |
| Attention chip | `AttentionZone.AttentionItem`, `NeedsAttentionStrip`'s inline buttons, `ReportsTab`'s inline buttons — three near-identical implementations of the same chip | Extract `AttentionChip` |
| Empty state | Good version in `TaskListView`/`TeamTasksTable`; thin version in `WorkLogsSection`/`UsersTab`; absent in report tables | One `EmptyState` component |
| Confirm-destructive | `CancelTaskDialog` and `DeactivateUserDialog` (both excellent) vs `confirm()` in `TaskTemplatesTab` | Extract `ConfirmDialog` from the two good ones |
| Capacity bar | `TeamWorkloadTracker.jsx:181–200` and `TeamCapacityForecast.cellClass` compute the same ratio with different thresholds and different color rules | One `CapacityMeter` |

**Components that are already right and should be the model:** `TaskActionMenu` (hides rather than
disables unavailable actions, and says why in comments), `BlockedPanel`, `CancelTaskDialog`,
`ScopeToggle`, `TaskFormFields`, `EntityReportTable`.

**Design-system enforcement:** 106 uses of raw Tailwind palette colors (`text-amber-400` ×37,
`text-violet-400` ×21, `text-green-500` ×13, …) bypass the semantic tokens that `index.css` already
defines. The `-400` shades in particular are chosen for legibility on dark and are the direct cause of
the light-theme contrast failures. Every one of these has a token equivalent
(`--success` / `--warning` / `--info` / `--destructive` / `--primary`).

---

## H. User Flow Findings

**Employee: login → dashboard → find task → start → pause/resume → complete → work log.** Clean.
The one friction point is the end: after completing tasks, nothing on the dashboard prompts the daily
work log — the user must remember to navigate to a different page. The log form is *already* prefilled
from exactly the work just finished, so the prompt has real value and low cost. Add a
"Submit today's log" call-to-action to `NeedsAttentionStrip` or the metrics row once tasks are
complete and no log exists.

**Manager: login → understand team → create → assign → monitor → review → approve/rework.** Solid,
with two friction points. (1) Understanding the team requires scrolling past four sections
(H1). (2) Approving from `PendingReviewQueue` is one click, but *rework* requires expanding an inline
textarea — good — while approving requires no comment at all, whereas approving from
`ApprovalGatingPanel` in the modal **requires** a comment (`disabled={… || !reviewComment.trim()}`).
The same business action has two different requirement levels depending on where it is performed.
That is a business-rule inconsistency, not just a UI one (Standard §27).

**Super Admin: login → org overview → users → teams → templates → calendar → reports.** Works. The
Overview → Organization → Reports separation is the right IA. The gap is that Organization changes
have invisible consequences: saving a template silently re-provisions tasks org-wide, and saving the
work calendar silently changes every capacity number in the product. `WorkCalendarTab` warns about
this up front (good); `TaskTemplatesTab` does not.

**Cross-cutting flows:**
- *Block task* — excellent. Reason required, distinguished from paused, visible to both roles,
  auto-unblocks on timer start, and the modal explains that.
- *Reassign* — excellent. Capacity-annotated candidate list is exactly the right information at the
  right moment. But it excludes managers/admins from candidates.
- *Cancel task* — excellent. Consequence preview, tracked-time warning, required reason, character
  counter.
- *Record time away* — good, and correctly placed on the workload card where the need is noticed.
- *Review overdue work* — good deep-link from `AttentionZone` into `/team-tasks?filter=overdue`.
- *Review overrun work* — **gap.** Overrun is surfaced as a per-task badge and a per-person pattern
  flag, but there is no "show me all overrunning tasks" filter, unlike overdue and blocked which both
  have one. `NeedsAttentionStrip` counts them for the employee but only scrolls; `AttentionZone` does
  not count them for the manager at all.

---

## I. Recommended UX Architecture

The three-role model is already correct in principle. The changes needed are naming, page boundaries,
and disclosure — not restructuring.

```
Employee  = My Work
Manager   = My Work + My Team
SuperAdmin= My Work + My Organization
```

**1. Name the two halves identically for every role.**

| | Employee | Manager | Super Admin |
|---|---|---|---|
| Personal | **My Work** (`/my-work`) | **My Work** (`/my-work`) | **My Work** (`/my-work`) |
| — sub-page | My Progress | My Progress | My Progress |
| — sub-page | My Work Log | My Work Log | My Work Log |
| Collective | — | **My Team** (`/team`) | **My Organization** (`/organization`) |
| — sub-page | — | Team Tasks | Org Tasks |
| — sub-page | — | Team Work Logs | Reports & Analytics |
| — sub-page | — | — | Setup (depts/teams/users/templates/calendar) |

Route `/employee` to `/my-work` and delete the duplicate entry point. The page `<h2>` should match the
sidebar label exactly, in every case. That alone resolves H3 and most of the IA score gap.

**2. Group the sidebar.** Two labelled sections — `MY WORK` and `MY TEAM` / `MY ORGANIZATION` — instead
of one flat seven-item list. The role badge in the header already tells the user who they are; the nav
should tell them which *hat* each link belongs to.

**3. Make the collective page a summary, not a stack.** Keep, above the fold and always visible:
`AttentionZone` → `ActiveWorkStrip` → the four metric cards → `PendingReviewQueue`. Move
`TeamWorkloadTracker`, `TeamSignalsPanel`, `TeamCapacityForecast`, and `WorkLogsSection` into tabs
(*Workload · Signals · Forecast · Logs*) directly beneath. Same components, same data, one screen
instead of ten sections. `AttentionZone`'s existing links become tab-switches, which also resolves the
mixed scroll/navigate model (M4).

**4. Fix the visual layer before anything cosmetic.** In order: C1 (define `badge-violet`), C2 (light-
theme badge values), C3 (stop using `*-foreground` as text color), then sweep the 106 raw palette
colors onto tokens. Everything in the Consistency and Responsive scores flows from this.

**5. Make rows keyboard-reachable.** Wrap the row-open interaction so it carries `role="button"`,
`tabIndex={0}`, and an Enter/Space handler — or make the task title an actual `<button>` inside the
cell, which is the simpler and more semantic option. Seven call sites, one shared helper.

---

## Recommended Order of Work

1. **C1, C2, C3** — the design-token repairs. Small, mechanical, and they fix the most visible damage.
2. **C4** — the Pending Backlog metric. A labelled number showing a different metric is the most
   serious correctness issue here.
3. **C5** — keyboard access to rows.
4. **H3 + I.1/I.2** — naming and sidebar grouping. Cheap, and it is the biggest single IA improvement.
5. **H1 + I.3** — collapse the manager Overview into tabs.
6. **H5, H7, H8, H9** — the correctness/copy cluster.
7. **H2, H6** — table sorting/pagination and tab unification.
8. **G** — component extraction pass, once the above has settled what the canonical version of each
   pattern is.

Items in D/E are worth doing but should not preempt any of the above.

---

## Changelog

### Slice 1 — C1–C4, design tokens and the backlog metric (2026-08-18)

**`Frontend/src/index.css`**
- Registered `--color-success` / `--color-warning` / `--color-info` (+ `-foreground`) in
  `@theme inline`, making 32 previously-dead semantic utility usages generate real CSS (**C3**).
- Darkened the light-theme `--success` / `--warning` / `--info` values to `oklch(0.480 …)` so they
  clear 4.5:1 as text on the near-white surface — they are used overwhelmingly as an icon/label color
  over a 5–15% tint of themselves. Their only solid-fill uses are two 1px decorative accent bars with
  no text on them, so nothing regressed. Light `--warning-foreground` flipped to near-white to stay a
  correct pairing for the darkened fill; the dark-theme value is correct as-is and unchanged.
- Defined `.badge-violet`, which `badge.jsx` referenced 7 times and which never existed (**C1**).
- Split every badge class into light-first values with a `.dark` override — they were previously
  defined once with dark-tuned lightness, making all five workflow status badges near-invisible in
  light mode (**C2**).
- Removed `.badge-teal` (defined, never referenced).

**Component fixes (C3, second half)** — repointed six `*-foreground`-as-text-color usages to the
base token, which would otherwise have rendered inverted once the scale went live:
`TeamCommandCenter.jsx` (Pending Review count), `MyWorkPanel.jsx` (Today's Tracked Time),
`TeamWorkloadTracker.jsx` (Review count), `AttentionZone.jsx`, `NeedsAttentionStrip.jsx`,
`ReportsTab.jsx`. The two *correct* `-foreground` usages (`TeamCapacityForecast`'s over-capacity cell,
`button.jsx`'s destructive variant) were left alone.

**`MyProgress.jsx` + `EmployeeDrilldownModal.jsx` (C4)** — the "Pending Backlog" card paired the
**paused** count with the **blocked** backlog's average age and the pending backlog's oldest age.
`getProgressReport` is explicit that a paused task's age "is meaningless because it mostly measures
overnight and weekends", and that `pendingBacklog*` are retained aliases now carrying the
blocked-based figure. So the ages were right and the count and title were wrong. Both cards are now
**Blocked Backlog** — count, average and oldest all from `blockedCount` / `blockedBacklog*`, with a
"working days" note — and paused is reported beneath as a bare count with no age, matching how
`TeamSignalsPanel` already splits the two.

*Verification:* `npm run build` clean; `eslint` on all 8 changed files reports only two pre-existing
issues in untouched code. Compiled CSS confirmed to contain the semantic utilities and both badge
themes; baseline build confirmed to contain zero of them.

*Not done in this slice, deliberately:* the remaining ~100 raw palette colors (finding G). Only the
two inside blocks already being rewritten for C4 were converted. That sweep is its own slice.

### Slice 2 — C5, keyboard access to detail rows (2026-08-18)

**New: `Frontend/src/components/ui/open-detail-button.jsx`** — makes a row's *title* a real
`<button>` that opens the detail view.

Chose this over the more obvious `role="button" tabIndex={0} onKeyDown` on the row/card itself, for
three reasons documented in the file:
- On a `<tr>`, `role="button"` replaces the row/cell semantics a screen-reader user navigates a table
  by — the row stops being a row.
- Every one of these rows already contains its own controls (status select, timer buttons, action
  menu). Nesting those inside a button is invalid HTML, and would make the row's accessible name the
  concatenation of everything inside it.
- The title is the accessible name a user actually wants announced, and it's where a sighted user
  aims anyway.

The container keeps its existing `onClick`, so clicking anywhere in the row still works for mouse
users; the button calls `stopPropagation` so a title click doesn't fire both handlers.

Applied to all 7 call sites: `TaskListView`, `TaskKanbanBoard`, `DailyTasksSection`,
`TeamTasksTable`, `TeamWorkloadTracker`, `EmployeesReport`, `WorkLogs`. In each case only the title
*text* is wrapped, not its trailing badges — otherwise the accessible name becomes
"Fix login bug Self Daily Carried from Aug 12 Blocked". In `WorkLogs`, which has no title column, the
work-summary cell is the anchor. `PendingReviewQueue` needed no change; it already opens its detail
view from a real "View Details" `<Button>`.

One layout detail: `DailyTasksSection` strikes through completed task titles via `line-through` on the
parent span, and `text-decoration` does not propagate into a button child — so the class is repeated
on the button.

*Verification:* `npm run build` clean; `eslint` on all 8 touched files reports only the pre-existing
`WorkLogs.jsx` effect warning (its line number shifted by the added import).

*Still open on accessibility:* this fixes the row-open path only. Focus is still not trapped or
restored around dialogs beyond what Radix provides by default, `sr-only` remains used once in the
whole app, and status is still communicated by color plus text but without icons in several places
(§21). Those are separate items, not covered here.

---

## What Was Deliberately Not Recommended

No new dashboards, metrics, charts, or features are proposed. Every recommendation is a repair, a
consolidation, or a disclosure change to something that already exists. The Locked Logic constraints
(no composite productivity score, signals kept separate, daily-first scope, soft-delete, non-punitive
framing) are respected throughout the current frontend and none of the above changes them.
