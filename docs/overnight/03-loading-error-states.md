# Workstream 3 — Loading / Empty / Error / Feedback States

Baseline first: this app already has a solid foundation for this workstream —
`ToastContext.jsx` provides a global toast() plus a global axios response interceptor that
auto-toasts almost every failed API call, `ErrorBoundary.jsx` catches render crashes with a
reload CTA, `Skeleton` is used consistently for data loading, and most tables already have
real three-state (loading / empty / data) rendering with explanatory empty copy instead of
bare "No data." The findings below are the genuine gaps in that otherwise-solid system.

## HIGH Priority

| Area | Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|---|
| Infinite loading | `Frontend/src/pages/MyProgress.jsx` + `store/useEmployeeDashboardStore.js` (`loadMyReport`) | If `/api/tasks/report` failed, the store's `catch` only logged the error and left `myReport` as `null` forever — the page's `if (!report) return <Skeleton>` branch never had a way out. | The page would show a loading skeleton **permanently** on any fetch failure, indistinguishable from "still loading" — looked frozen with no recovery path. | Added a `myReportError` flag to the store, set on fetch failure and cleared on retry; `MyProgress.jsx` now renders a "Couldn't load your progress" card with a Retry button instead of looping back into the skeleton when the fetch has failed and no data has ever loaded. | FIXED | HIGH |
| Infinite loading | `Frontend/src/components/dashboards/superadmin/ReportsTab/ReportsTab.jsx` + `store/useReportsStore.js` (`fetchReports`) | Same bug as above: `if (loading || !reports) return <skeleton>`, and a failed fetch left `reports: null` forever with no error tracked. | SuperAdmin's entire Reports tab would appear to hang indefinitely on any report-fetch failure. | Added an `error` flag to the store, set/cleared around `fetchReports`; `ReportsTab.jsx` now shows a "Couldn't load reports" card with a Retry button before falling through to the skeleton branch. | FIXED | HIGH |
| Silent no-op on submit | `Frontend/src/components/dashboards/manager/CreateTaskModal.jsx` (`handleCreateTask`) | Submitting the create-task form with no assignee selected just `return`ed — no toast, no inline message, nothing. The "Assigned To" field is a themed `Select`, so native HTML5 required-field validation never fires either. | Clicking "Assign Task" appeared to silently fail with zero explanation — a real dead-end for the user. | Added `toast.error("Please select an assignee before creating the task.")` before the early return. | FIXED | HIGH |

## MEDIUM Priority

| Area | Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|---|
| Consistency / silent failure | `Frontend/src/store/useOrgStore.js` — `fetchDepartments`, `fetchTeams`, `fetchUsers` | These three fetch functions had `try { } finally { }` blocks with **no `catch`** — every other store in the app (`useEmployeeDashboardStore`, `useManagerDashboardStore`, `useTaskTemplatesStore`, `useReportsStore`) explicitly catches and logs. Worked today only because the global axios interceptor happens to cover it. | Fragile: any future non-axios throw inside these functions would be a genuinely unhandled rejection with no logged trail, and the inconsistency with every other store makes the codebase harder to reason about. | Added explicit `catch (err) { console.error(...) }` blocks to all three, matching the pattern used everywhere else. | FIXED | MEDIUM |
| Native dialogs | `Frontend/src/components/dashboards/superadmin/TaskTemplatesTab.jsx:205,209` | Used native `alert()` for two validation messages instead of the app's toast system (the only place in the app that does this). | Jarring, unstyled, theme-breaking, thread-blocking — and inconsistent with how every other validation error in the app is surfaced. | Replaced both `alert()` calls with `toast.error(...)`. | FIXED | MEDIUM |
| Empty vs. error conflation | Every zustand store's fetch `catch` block (`useEmployeeDashboardStore`, `useManagerDashboardStore`, `useOrgStore`, `useTaskTemplatesStore`) sets `loading:false` but (before tonight) tracked no `error` state | A failed load and a genuinely-empty dataset render identically — if a user's 5-second toast disappears before they look back at the screen, they can't tell "there's nothing here" from "it failed to load," and there's no retry action anywhere except the two pages fixed above. | Fixed the two screens where this produced a literal infinite-skeleton bug (`MyProgress`, `ReportsTab` — see HIGH). Did not add an `error` field + retry UI to every remaining store/component (`useManagerDashboardStore`, `useTaskTemplatesStore`, `OrgPulseStrip`, `TeamCapacityForecast`, `TeamSignalsPanel`) — those don't get stuck the same way (they resolve to their normal empty-state copy, just without distinguishing "empty" from "failed"), so it's a real but lower-urgency gap best done as one deliberate pass across all stores rather than piecemeal tonight. | PARTIALLY FIXED | MEDIUM |

## LOW Priority

| Area | Location | Problem | Why it matters | What was changed | Status | Priority |
|---|---|---|---|---|---|---|
| Silent empty section | `Frontend/src/components/dashboards/superadmin/OrgPulseStrip.jsx` | `if (!reports) return null` after a failed fetch — the section just disappears with no explanation. | Looks like a removed feature rather than a failed request; low impact since it sits on a dashboard with other visible content. | Not changed — folds into the broader "add error state to every store" follow-up noted above. | NOT FIXED | LOW |
| Silent empty section | `Frontend/src/components/dashboards/manager/TeamCapacityForecast.jsx`, `TeamSignalsPanel.jsx` | Both return `null` when there's no data, without distinguishing "manager has zero direct reports" (a normal, self-explanatory state) from "the report fetch failed." | Minor — the "zero direct reports" case is genuinely rare and self-evident from context; the fetch-failure case is the same broader gap noted above. | Not changed. | NOT FIXED | LOW |
| Destructive-action confirmation | `Frontend/src/components/dashboards/superadmin/TaskTemplatesTab.jsx:228` (`confirm()` before delete) | Uses a native browser `confirm()` dialog rather than an in-app themed dialog. | It does correctly block the delete until confirmed — the safety property is intact, just visually inconsistent with the rest of the app. | Not changed (see `02-ui-ux-improvements.md`). | NOT FIXED | LOW |

## Verified as already well-handled (not flagged)

- `TimerContext.jsx` — every timer action (Start/Pause/Resume/Stop) does optimistic UI update + rollback-on-failure, with buttons disabled mid-request across `TaskListView`, `TaskKanbanBoard`, and `TaskTimerPanel`. No double-submit risk.
- `useTaskStatusMutation.js` — shared optimistic status-transition hook with rollback, used consistently by both dashboards and both task detail modals.
- Every reviewed form (`Login.jsx`, both `CreateTaskModal`s, `WorkLogs.jsx`, `OnboardingWizard.jsx`, `DepartmentsTab`/`TeamsTab`/`UsersTab`) has a `submitting`-gated disabled submit button, preventing duplicate submissions.
- `ApprovalGatingPanel.jsx` requires a non-empty comment before Approve/Rework is enabled — an effective soft-confirmation on a destructive review action.
- Every table checked (`TaskListView`, `TaskKanbanBoard`, `TeamTasksTable`, `WorkLogsSection`, `UsersTab`, `DepartmentsTab`, `TeamsTab`) has explanatory empty-state copy, not a bare "No data."
- `WorkLogs.jsx` is the best-built reference in the app for this workstream: explicit loading/empty/error copy, a `submitting` state, and a "prefilling" spinner label — worth using as the template for future forms.

## Summary

- Issues found: 10
- Issues fixed: 6 (2 HIGH infinite-loading bugs, 1 HIGH silent-no-op form, 3 MEDIUM consistency fixes)
- Issues not fixed: 4
- Needs my decision: 0 (remaining items are scoped follow-up work, not decisions blocked on business judgment — see "PARTIALLY FIXED"/"NOT FIXED" notes above for why they were deferred rather than rushed)
- Important notes: The two infinite-skeleton bugs (MyProgress, SuperAdmin Reports tab) were the most serious finding in this workstream — a real user hitting a flaky network moment would see a permanently "loading" page with no way to recover short of a full page refresh. Both are fixed and build-verified. The broader "add a tracked `error` state to every store" work is a good, low-risk follow-up but was scoped down tonight to the two screens where it was an actual bug rather than a stylistic gap.
