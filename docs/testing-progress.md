# Testing Programme — Progress Tracker

Living checklist for the approved testing strategy. **Updated as work lands** — check
the "Last updated" line at the bottom to see how current it is.

Legend: `[x]` done and verified · `[~]` in progress · `[ ]` not started · `[!]` blocked / needs your decision

---

## Where things stand right now

| | |
|---|---|
| **Tests passing** | **936** (753 backend, 183 frontend) + **9 E2E** |
| **Phase 6** | ✅ **COMPLETE** — all 12 findings resolved, including the 2 previously-open items |
| **Phase 7** | ✅ **COMPLETE** — payload trim, perf assertions, and all 5 E2E flows |
| **Lint** | 0 errors, 3 warnings (the async-loader pattern the rule cannot distinguish) |
| **Stability** | 3/3 consecutive runs rotating through all three timezones (unit/integration); E2E green on 3 consecutive full runs (2 standalone, 1 against a replica set) |
| **CI** | Workflows written; not yet run on GitHub — deliberately deferred, your call |
| **Current phase** | **All 7 phases, the full Phase 6 backlog, and the regression backlog are complete.** Only the first real CI run on GitHub remains, and that's on hold by your choice, not blocked. |

Coverage of everything targeted so far:

| Backend | Lines | Branches |   | Frontend | Lines | Branches |
|---|---|---|---|---|---|---|
| `config/workflow.js` | **100%** | **100%** |   | `lib/stepper.js` | **100%** | **100%** |
| `services/taskMetrics.js` | **100%** | **100%** |   | `lib/taskConstants.js` | **100%** | **100%** |
| `services/taskScopeService.js` | **100%** | **100%** |   | `lib/taskScope.js` | **100%** | **100%** |
| `services/calendarService.js` | 84% | 77% |   | `lib/utils.js` | **100%** | **100%** |
| `services/taskService.js` | 45% | 40% |   | `lib/taskFormatters.js` | 97% | 82% |
| | | |   | `lib/taskHelpers.js` | 70% | 69% |

The gaps are by design: `taskService` and `calendarService`'s remaining functions need a
database (Phase 3), and `taskHelpers`' untested share is the capacity code already
covered from the backend side by the capacity mirror contract.

Run it yourself:

```bash
npm test                       # everything, from the repo root
npm run test:unit --prefix Backend    # fast path, no database (~1s)
npm run test:coverage          # with coverage report
```

---

## Phase 0 — Enablement ✅ COMPLETE

Making tests possible at all. No product behaviour tested yet — this is the scaffolding.

### Tooling
- [x] Vitest 4 installed in both packages
- [x] supertest + mongodb-memory-server (backend)
- [x] @testing-library/react + jsdom (frontend)
- [x] @playwright/test (root) — browsers **not** downloaded, see blockers
- [x] Dependency count held to 6 + jsdom, as promised in the strategy

### Backend harness
- [x] `app.js` extracted from `index.js` so supertest can drive the real app with no port bound
- [x] Verified the refactored server still boots, connects, schedules the cron, and serves routes
- [x] `vitest.config.js` (full, with database)
- [x] `vitest.unit.config.js` (no database — the fast watch-mode path)
- [x] `vitest.perf.config.js` (nightly, excluded from normal runs)
- [x] One real in-memory MongoDB per run, **one database per worker** so parallel files can't clear each other
- [x] `syncIndexes()` on startup — without it the partial unique indexes wouldn't be enforced and every concurrency test would be meaningless
- [x] Collections + OrgSettings cache cleared before every test
- [x] Test env forces the **production** error branch, so tests assert what real users receive

### Backend utilities
- [x] `helpers/api.js` — `api()` / `asUser()` / `asToken()`
- [x] `helpers/auth.js` — valid, expired, forged and malformed tokens
- [x] `helpers/clock.js` — freezes `Date` only (faking timers would deadlock the Mongo driver)
- [x] `helpers/queryCounter.js` — `countQueries()` for N+1 bounds, `winningPlanStage()` for index assertions

### Backend fixtures
- [x] Factories: user, task (incl. daily / assigned / history / rework), session (running / paused / resumed / stopped), department, team, template, absence, work log, org settings
- [x] `buildOrg()` — the standard cast (admin, 2 managers, 2 peers under one manager, 1 under the other, 1 unmanaged) so every authorization case has a concrete actor
- [x] Deterministic: no random data, bcrypt hash computed once per worker

### Frontend harness
- [x] `vitest.config.js` — jsdom, presentational components excluded from coverage by design
- [x] `src/tests/setup.js` — RTL cleanup, storage reset, jsdom gaps Radix needs (matchMedia, ResizeObserver, pointer capture)
- [x] `src/tests/axiosMock.js` — full axios surface incl. `defaults` and `interceptors` (automock provides neither); unrouted requests fail loudly instead of resolving `undefined`
- [x] `src/tests/renderWithProviders.jsx` — opt-in providers

### CI/CD
- [x] `.github/workflows/ci.yml` — lint, build, backend-unit (3-timezone matrix), backend-integration, frontend-unit, coverage on PRs
- [x] mongod binary cached — without it CI re-downloads 591MB every run (that was the entire 479s of the first local run; cached it's 3.4s)
- [x] `.github/workflows/nightly.yml` — perf budgets, gated off until written
- [x] Coverage floors wired per-directory, enforced only when `COVERAGE_ENFORCE=1` so they can ratchet up phase by phase
- [x] Root `package.json` for one-command orchestration
- [x] `.gitignore` updated for test artifacts

### E2E scaffolding
- [x] `e2e/playwright.config.js` — starts both servers itself on ports 3100/4173, so it never touches your dev servers
- [x] Disposable-database contract: seed fixture **refuses to run** unless the database name contains `e2e` (verified — it correctly rejected the dev URI)
- [x] Browser binaries downloaded (`npm run e2e:install`) — chromium present, verified via `npx playwright --version`
- [x] `e2e/fixtures/seed-e2e.js` — `globalSetup`, wired into the config, so every run reseeds automatically rather than depending on a manual `npm run e2e:seed` step beforehand
- [x] Specs written — Phase 7, see below

### Verified end to end
- [x] Backend unit 3 passed · integration 10 passed · frontend 6 passed
- [x] Timezone matrix passes in UTC, Asia/Kolkata, America/Los_Angeles
- [x] Coverage enforcement correctly fails when switched on
- [x] Frontend build still succeeds
- [x] Server boots and serves after the `app.js` split

---

## Blockers and decisions needed from you

- [x] ~~Pre-existing lint failures~~ — **fixed, 0 errors.** See "Lint cleanup" below for what was done and why.
- [x] ~~Extract `services/taskMetrics.js`~~ — **done and proven behaviour-preserving.**
- [x] ~~Playwright browsers not installed~~ — resolved; chromium present, Phase 7's suite runs on it.
- [x] ~~Three real cascading-render sites~~ (`AuthContext`, `TimerContext`, `MyWorkPanel`) — all three fixed as Phase 6 items; verified against current source.

---

## Lint cleanup ✅ COMPLETE

16 problems / 10 errors → **0 errors, 4 intentional warnings, exit 0.**

- [x] `react-refresh/only-export-components` (6 errors) — switched off for `src/context/**` and `src/components/ui/**`. A context module exporting a Provider, a `useX` hook and the context object is the standard React pattern, and shadcn ships `*Variants` beside its components. Splitting either apart would touch every import site to satisfy a rule that only affects dev-time Fast Refresh.
- [x] `react-hooks/exhaustive-deps` (6 warnings) — targeted disables with a stated reason on each, matching the style already used in `MyWorkPanel`. Comment-only, zero behaviour change.
- [x] `react-hooks/set-state-in-effect` (4 errors → warnings) — **downgraded after verifying empirically that the rule cannot distinguish a real cascade from ordinary async data loading.** A probe confirmed that a plain `useEffect(() => { load() }, [])`, where `load` is async and only sets state after an `await`, is flagged identically to `useEffect(() => setX(1), [])`. At error severity it condemns every fetch-on-mount effect in the app. Kept as a *warning* rather than switched off, because three of the four sites do contain genuine synchronous cascades worth removing later.

---

## Phase 1 — Pure unit tests ✅ COMPLETE

Highest value per hour. No database, no HTTP. 416 of the 457 tests, running in ~4s.

- [x] **`services/taskMetrics.js` extracted** from `taskController.js` — 11 functions/constants moved out of a 1,200-line controller so they can be tested directly. Verified character-identical against the pre-refactor source once comments are stripped; dead `workingDaysBetween` import removed from the controller.
- [x] **`taskMetrics` unit tests — 24 assertions, first real product-logic coverage.** Overrun with no estimate / exact-equal / over / under / tracked-nothing; rework counting across multiple round trips; `wasEverReviewed` excluding non-review work; latest-not-first rework feedback; blocked age returning `null` vs `0`, skipping weekends, and never going negative for a future timestamp; the full progress mapping incl. legacy statuses; and the locked pattern/quality thresholds.
- [x] **`config/workflow.js` — exhaustive matrix, 100% coverage.** All 150 combinations of 3 roles × 2 assignment types × 5 from-states × 5 to-states, asserted against a hand-written truth table (deliberately *not* derived from `WORKFLOW_RULES`, or it would only prove the code equals itself). Plus the product rules stated in plain sentences: self-assigned work completes without review, manager-assigned work cannot skip it, employees can never reopen Completed, managers can, and the timer's Pending ↔ In Progress round trip works for every role.
- [x] **`calculateSessionElapsedSeconds` — the timer arithmetic.** No events / paused / resumed / several pause-resume cycles; a task paused overnight staying frozen rather than accruing the whole night; fractional flooring; clock skew never producing negative time; ISO strings as well as `Date` objects.
- [x] **`calendarService` — capacity and the working-day maths.** Weekend, holiday, leave, sick, half day, no-hours-configured; weekend correctly taking precedence over an absence spanning it; `workingDaysBetween` skipping weekends and holidays and terminating on an absurd range; `getNextWorkingDay` skipping to Monday; part-time and unconfigured employees.
- [x] **Mirror contracts — 3 of 4 written.** Timer math (`taskService` vs `workSessionController`), workflow + progress mapping (backend rules vs the frontend dropdowns), capacity (`getCapacityForDay` vs `getEmployeeCapacity`) and planned-hours agreement.
- [x] **`buildScopeFilter` — filter shape and date boundaries at 100%.** All six disjunction clauses, the today/week windows, and that time-of-day is normalised away so the result never depends on when it ran.
- [x] **Scope mirror contract, against a real database.** ~17 task fixtures spanning every clause fed to both `buildScopeFilter` (as a Mongo query) and `isTaskInScope` (as a JS predicate); identical ID sets asserted for `today`, `week` and `all`. Includes explicit regression locks: an incomplete daily task is never hidden whatever its `dailyDate`, overdue open work is never hidden, and a task due 23:59 today still lands in Today.
- [x] **Frontend `taskFormatters`, `taskScope`, `taskHelpers`, `stepper`, `utils`.** Heavy on the zero-versus-not-applicable distinction (§41), plus `buildEmployeeSignalSummary` asserted by *which branch it chose*, never by its prose.

### Findings from Phase 1

One real bug fixed, two divergences pinned. The divergences are documented by passing
tests rather than silently fixed, so the changes land with the rest of the Phase 6
consistency work.

- **🐛 FIXED — `isSelfCreated` treated manager-assigned work as self-assigned whenever
  task refs were not populated.** It compared `task.assignedBy?._id` to
  `task.assignedTo?._id` first, which on an unpopulated task is `undefined === undefined`
  — always true — so the raw-id fallback written right beside it never ran. Consequence:
  the employee would be offered a "Completed" transition the server then rejects, and the
  stepper would hide the review step. Latent today because list endpoints populate those
  refs — but **Phase 6's payload-trimming work removes exactly those populates**, so it
  was a landmine on a path already scheduled. Fixed, with the failing-first test kept
  beside it in `taskHelpers.test.js`. A task with no assignment data now reads as
  review-gated, the safe default.

- **Timer math diverges on a session with no `events` array.** `taskService` guards with
  `session.events || []`; `workSessionController` reads it directly and throws. Not
  reachable today (Mongoose always materialises `events` as `[]`) but it becomes
  reachable the moment a timer endpoint switches to a `.lean()` or projected read —
  which is a plausible response to the payload work already queued for Phase 6.
- **Capacity diverges on the reason given when an employee has no configured hours.**
  Both sides agree on 0 hours, so no number is wrong and no assignment is wrongly
  blocked. But the backend says `no_hours_configured` while the frontend says `null`, so
  the workload bar shows an unexplained 0h where the admin report explains it. The
  frontend's `CAPACITY_REASON_LABELS` already has the label — nothing ever produces it.

---

## Phase 2 — Authorization contract tests ✅ COMPLETE

Security-critical. Table-driven: every actor × every protected endpoint → exact status.

248 integration tests across four files.

- [x] **Employee acting on a coworker's task → 403** across all six single-task routes (status, comment, edit, block, cancel, timer-start), for a same-manager peer and for another reporting line, and for an unrelated manager. Plus an assertion that after every rejected attempt the target task is **byte-for-byte unchanged** — a 403 that still wrote something would be worse than no guard.
- [x] **Route role-gating matrix** — 36 endpoints × 3 roles, asserted in *both* directions: 403 for every role not on the allow-list, and not-403 for every role that is. A guard removed by accident fails the first; a guard added too broadly fails the second.
- [x] **`?assignedTo` narrows, never widens** — for both employees and managers.
- [x] **Query injection** — see the finding below; the real vector turned out to be repeated parameters, not bracket syntax. Also: a hostile `?limit=100000` is clamped.
- [x] **Mass assignment** — `status`, `isActive`, `history`, `assignedBy`, `isBlocked` via PATCH all → 403 `FIELD_NOT_EDITABLE`. Employees cannot widen their own narrower field set.
- [x] **Manager reassigning outside their line → 403**; daily tasks refuse reassignment entirely.
- [x] **Scoping** for report, work logs, calendar absences and active-team, per role.
- [x] **Deactivated user with a still-valid JWT → 401**, and a demoted manager's old token loses manager powers immediately (the role is read from the database, not the token).
- [x] **Login rate limiter → 429**, including that the *correct* password is also blocked once the limit is hit, and that other endpoints stay usable.
- [x] Account enumeration: wrong password and unknown email return identical responses; no password hash is ever serialised.

### Findings from Phase 2

- **Query injection works differently than the code comment claimed.** This app runs
  Express 5, whose query parser defaults to `simple`, not Express 4's `extended`. Verified
  against express@5.2.1: `?status[$ne]=Completed` parses as the literal key
  `"status[$ne]"`, so `req.query.status` is `undefined` and **no operator object is ever
  built** — the filter is skipped and the caller's visibility scope is untouched. The real
  non-string vector is a *repeated* parameter (`?status=a&status=b`), which does arrive as
  an array and is what the `typeof !== "string"` guard actually catches today. The guard is
  correct and worth keeping broad — it must still hold if the parser is ever switched back
  — but the comment describing it was wrong, and is now corrected. Both cases are covered.
- **The test gate could pass vacuously.** Vitest exits 0 when its include pattern matches
  no files, so a broken pattern or a mis-mounted volume in CI would turn the whole gate
  green while running nothing. Surfaced by a one-off local run that reported "no tests"
  and could not be reproduced. `passWithNoTests: false` is now set on all four configs,
  and verified to exit 1.
- Pre-existing, not fixed: `userController.updateUser` uses the deprecated `new: true`
  option on `findByIdAndUpdate`, which logs a Mongoose deprecation warning on every call.
  Cosmetic; queued as a Phase 6 tidy.

---

## Phase 3 — Workflow + timer integration ✅ COMPLETE

- [x] **Both lifecycles end to end** — self-assigned (and daily) completing without review; manager-assigned refused a direct completion and routed through In Review; employees locked out of work sitting in review.
- [x] **Timer** — start/pause/resume/stop side-effects, task-switching auto-stopping the previous session and pausing that task, idempotent double-pause and double-resume, session rehydration after a refresh, and no cross-employee leakage. The "exactly one active session per employee" invariant is asserted after every action.
- [x] **Auto-unblock on both start AND resume** — the Iteration 13 regression, locked on both paths, plus a check that merely pausing does *not* unblock.
- [x] **Completed work locked** — edits and cancellation 409, blocking refused, comments still accepted, no employee reopen, manager reopen allowed.
- [x] **Rework round trips** — `reworkCount` increments per return, and the manager's report traces the flag back to the specific task and the feedback given.
- [x] **Reassignment** stops the previous assignee's timer, flips the task to Paused, retains the session, and writes an audit entry naming both people.
- [x] **Cancellation** is a soft delete: gone from lists, sessions and history retained, running timer closed, reason required, employees limited to their own not-yet-started work.
- [x] **Blocked** is orthogonal to status — the assignee can declare it, reason required to block but not to unblock, double-block and redundant-unblock rejected.
- [x] **Optimistic concurrency** 409s on both status and field edits, for the sequential stale-tab case.
- [x] **Concurrency suite** — 13 tests covering simultaneous timer starts (including a five-way burst), duplicate work-log submission, competing edits, and overlapping provisioning.
- [x] **Regression backfill complete** — all six shipped bugs now covered; see `Backend/tests/regression/README.md` for the map.

### Findings from Phase 3

Four concurrency gaps, all real. Three are marked `it.fails` — they assert the correct
behaviour and are currently expected to fail, so **fixing any of them makes the test fail
and forces it to be promoted to a normal test.** None is silently accepted.

- **Optimistic concurrency does not survive true simultaneity.** The `updatedAt` check is
  read-compare-write with no atomicity: two requests firing at once both read the same
  version, both pass, and both write — one edit silently lost. It works correctly for the
  case it was built for (a stale browser tab, where requests are sequential), which is
  covered and passing. Fix: a conditional `findOneAndUpdate` on `{_id, updatedAt}` so the
  database does the compare-and-swap. *(2 markers: field edits, status changes.)*
- **A task can be left In Progress with no timer behind it.** `previousTaskId` is read
  before the new session is created, so under two simultaneous starts the second request
  can see "nothing active" and never pause the first task — leaving two tasks In Progress
  with one timer. Precisely the staleness `ActiveWorkStrip` exists to avoid. *(1 marker.)*
- **Nothing stops concurrent provisioning creating duplicate daily tasks.**
  findOne-then-create with no uniqueness constraint, and the cron and login self-heal
  overlap by design. Same outcome as the Iteration 13 duplication bug, different cause.
  The race is *not* reliably reproducible, so rather than ship a flaky test this asserts
  the deterministic root cause: **there is no unique index on
  `{assignedTo, templateRef, dailyDate}`.** Adding one in Phase 6 flips this test.
- **A timer can still be started against Completed work.** `startSession` checks ownership
  but creates the session before consulting the workflow rules. The status transition is
  correctly refused, so the task stays Completed — but time keeps accruing against a
  record Locked Logic §4 says is final, moving its overrun figures. Documented in
  `integration/timer.test.js`.

Also fixed while writing these: the provisioning tests used the real clock against a
Mon–Fri calendar, so they would have passed all week and failed every weekend. They now
set an all-days calendar.

---

## Phase 4 — Report + provisioning golden tests ✅ COMPLETE

35 tests against a deterministic fixture whose every number is hand-derived — the
fixture deliberately sits each metric on a boundary rather than in a comfortable middle.

- [x] **Checked-in goldens** for the whole employee row and the org summary, with ObjectIds normalised and dates kept. Updated only via `UPDATE_GOLDEN=1`, so a metric change lands as a reviewable diff instead of a number that quietly moved.
- [x] **Counts and rates** — status counts, overdue measured from the deadline (not the report's date filter), daily vs assigned vs overall completion kept separate, new vs carried-forward split.
- [x] **Utilisation `null`, never 0%,** on a holiday, on leave, and on a non-working day; half-day capacity halved; `isCapacityOverrunToday` as its own signal distinct from utilisation.
- [x] **Estimation accuracy** `null` when work was estimated but never tracked (the case that once produced a >4000% figure), 100 when nothing was estimated, 80 for the fixture's real numbers.
- [x] **Quality** — first-pass rate over review-gated work only, `null` for someone with none, and no signal flagged on a 2-task sample.
- [x] **Pattern detection just under its threshold** — 1 of 3 recent estimated tasks overran (0.33), so no pattern is flagged; work finishing exactly on estimate is proved not to count as an overrun.
- [x] **Blocked age in working days across a weekend** — blocked Wednesday, read Monday, reported as 3 not 5.
- [x] **Date filtering** honours a bare `YYYY-MM-DD` range across the whole end day, and overdue stays absolute when the range excludes the task.
- [x] Provisioning depth (weekend/holiday skip, absence vs half-day, soft-cancel replacement, idempotency) is covered in `regression/03` and `concurrency.test.js`.

### Findings from Phase 4

- **Department and team breakdowns are grouped on different bases.** `teamReport` groups
  by the USER's team; `departmentReport` groups by the TASK's own department, which
  `createTask` leaves null unless a manager fills the field. For the same seven tasks by
  the same seven people, the team report reads "Platform: 7" while the department report
  reads "Unassigned: 7" and has no Engineering row at all. Not data loss, but a manager
  comparing them side by side has no way to tell why they disagree (§14). Recorded as a
  known decision.
- **The task factory was producing data the app could never produce.** It set `status`
  without the matching `progressPercentage`, so every fixture task had 0% progress and
  `avgProgress` was meaningless. Caught by reading the first generated golden rather than
  by a failing assertion. The factory now derives progress from status.
- **`it.fails` proved too flaky to ship, and was replaced.** Two spurious reds in roughly
  fifteen runs — a race that resolves benignly makes an `it.fails` pass, which is then
  reported as a failure. All three markers now use a `demonstrateRace` helper that
  retries and asserts the broken outcome is *reachable*: quiet today, and still fails the
  moment a fix makes it unreachable. Hunting the last flake also exposed a bug in my own
  test — the retry loop rebuilt the org each attempt, colliding on the fixed email
  addresses introduced for golden stability.

---

## Phase 5 — Frontend critical paths ✅ COMPLETE

- [x] `TimerContext` optimistic start/pause/resume/stop: success reconciliation, failure rollback, 404 clearing — `TimerContext.test.jsx`
- [x] `useTaskStatusMutation` / `useTaskMutation` rollback — `useTaskMutation.test.js`
- [x] `ProtectedRoute` role gating — `ProtectedRoute.test.jsx`

---

## Phase 6 — Hardening exposed by the tests ✅ COMPLETE

Safe to do once behaviour is pinned.

- [x] **Collapsed the two timer implementations.** `calculateSessionTime` now delegates
      to `calculateSessionElapsedSeconds` and adds only the `isRunning` flag, keeping the
      safe `events || []` guard. The contract test is retained as proof the consolidation
      was behaviour-preserving and as a guard against re-duplication.
- [x] **Frontend capacity now reports `no_hours_configured`,** matching the server. The
      label had existed in `CAPACITY_REASON_LABELS` all along with nothing producing it.
- [x] **Optimistic concurrency is now atomic.** The `updatedAt` comparison moved from
      JavaScript into the update filter, so MongoDB performs the compare-and-swap:
      simultaneous edits now yield exactly one 200 and one 409 instead of silently losing
      an edit. Writes that send no version keep the previous unconditional behaviour.
- [x] **Duplicate daily tasks are now impossible.** A partial unique index on
      `{assignedTo, templateRef, dailyDate}` (active, template-derived dailies only), with
      provisioning treating the duplicate-key error as "another run got there first".
      Application logic alone could never close this — two processes cannot coordinate a
      check-then-act between themselves.
- [x] **A timer can no longer be started on work that cannot be in progress.** The
      workflow rules are consulted BEFORE the session is created, so Completed and
      In Review work returns 409 `TASK_NOT_STARTABLE` instead of quietly accruing time
      against a locked record.
- [x] **No task is left In Progress without a timer.** `startSessionForTask` now reports
      the sessions it stopped, and reconciliation runs AFTER each request's own write —
      the second half of the bug was pausing a task while it was still "Not Started",
      where the transition is illegal and silently did nothing.
- [x] **Fail fast on missing configuration.** No `JWT_SECRET` refuses to start (every
      login would otherwise 500 while the health check reported "ok"); a failed database
      connection now exits instead of serving a healthy-looking but broken process.
- [x] **Demo credentials cannot reach production.** Gated behind `import.meta.env.DEV`, a
      compile-time constant, so the bundler removes the block entirely — verified by
      grepping the built assets for the passwords and emails.
- [x] Mongoose's deprecated `new: true` replaced with `returnDocument: "after"`, and
      `runValidators` added while touching it.
- [x] **All three cascading renders removed.** `AuthContext` now derives its initial
      `loading` from whether a token exists, so the no-token path sets no state at all —
      and it gained 11 characterisation tests first, written before the change so it was
      measured against behaviour rather than intention. `TimerContext`'s reset in the
      no-user branch turned out to be unreachable anyway (ProtectedRoute unmounts the
      provider), so the effect simply returns early. `MyWorkPanel` now DERIVES the open
      dialog's task from `tasks` instead of writing it back on every list refresh —
      `detailTask` still records which task is open, but only the rendered value is
      computed. Lint went from 4 such warnings to 2, and the 2 that remain are the
      async-loader pattern the rule cannot distinguish (verified by probe in Phase 5).
- [x] **Duplicate-cleanup script for the new uniqueness constraint** —
      `npm run dedupe:daily` (dry run) / `dedupe:daily:apply`. Needed because MongoDB
      refuses to build a unique index over existing duplicates AND Mongoose does not
      crash when that happens: it logs and carries on, so the app would come up looking
      healthy with the constraint silently absent. Keeps the instance that has real work
      on it (tracked time, or a status past "Not Started") rather than blindly the
      oldest, soft-deletes the rest with an audit entry, and is covered by 10 tests —
      including one asserting the end state can actually build the index. A dry run
      against the dev database reports 0 duplicates.
- [x] **The day-attribution rule is now a decision, not an accident.** A work session
      belongs entirely to the local day it STARTED — never split at midnight, never moved
      to the day it ended. Splitting is more literally accurate and was rejected: it means
      slicing every pause/resume window per day inside the most safety-critical
      calculation in the app, to serve a case a single-office team hits approximately
      never. Written up where the code lives, cross-referenced from the report, and pinned
      by 10 tests — including the accepted consequence that a timer running since 23:30
      shows "0h today" beside a live clock, and a check that the hours figure, the
      work-log prefill and the date-filtered report all agree.
- [x] **Work logs opened to every role.** `POST /api/daily-work-logs` was employee-only,
      which contradicted the "everyone is a worker" model that had already given managers
      and admins tasks, timers and daily tasks. Submission is now open to all (it always
      writes for `req.user.id`, so there is nothing to widen); a manager sees their own
      logs alongside their reports'; and `today-context` returns the caller's own prefill
      *plus* the compliance view. Crucially the two questions are now separate: **who may
      record their own day** is everyone, **whose submission do I chase** is the people I
      manage — never myself. 19 tests.
- [x] ~~Transaction around timer + status writes~~ — **done, 2026-08-19.** Investigated
      first rather than assumed: the actual dev/prod `MONGODB_URI` (`Backend/.env`) is a
      `mongodb+srv://...mongodb.net` MongoDB Atlas cluster, which is *always* a replica
      set (even the free tier) — the "needs a replica-set deploy change" blocker this
      item was flagged under didn't actually apply to the real database, only to the
      test harness's standalone in-memory Mongo. New `Backend/utils/transaction.js`
      (`runInTransaction`, wraps `session.withTransaction()`) is now used by
      `pauseSession`/`resumeSession`/`stopSession` (`workSessionController.js`) and by
      `updateTaskStatus`'s "leaving In Progress" branch (`taskController.js`) — the
      writes that had no atomicity at all before. Deliberately **not** used for the
      "entering In Progress" branch or the dedicated `/work-sessions/start` endpoint,
      both of which go through `startSessionForTask`'s stop-then-create retry, whose
      concurrency safety depends on reacting to the database's own duplicate-key
      rejection outside a transaction — forcing that into transaction semantics would
      change its failure behaviour and risk regressing the Phase 3 concurrency suite
      for a smaller, well-scoped win. `tests/setup/globalSetup.js` switched from
      `MongoMemoryServer` to `MongoMemoryReplSet` (single node) so transactions are
      exercised for real in tests, not skipped. New regression test in
      `task-lifecycle.test.js` — "rolls back the session stop too when the status write
      is rejected as stale" — proves the pair commits or aborts together by forcing a
      version conflict and asserting the WorkSession was NOT left stopped. Verified: full
      backend suite (753 tests) and full E2E suite (9 tests) both green against a real
      replica-set instance.
- [x] ~~Stop populating `comments` / `history` on list endpoints; cap and paginate~~ — done in Phase 7's payload trim (`getTasks` sends `commentCount`/`historyCount`, not the arrays)
- [x] ~~Make provisioning-on-template-save asynchronous~~ — **done, 2026-08-19.**
      `createTemplate`/`updateTemplate` (`taskTemplateController.js`) now call
      `provisionInBackground()` — fire-and-forget, not awaited — instead of blocking the
      response on `provisionDailyTasksForAllEmployees()`. The `.catch` on it is load
      -bearing, not decoration: an unhandled rejection on an un-awaited promise would
      otherwise hit `index.js`'s `unhandledRejection` handler and take the whole server
      down over one employee's provisioning failing. Tradeoff, accepted per your
      decision: the response now confirms the template is saved, not that provisioning
      has finished — unchanged from before, an employee with the dashboard already open
      still only sees the new task on their next load (no polling/websockets).
- [x] ~~Fail fast on missing `JWT_SECRET` and on DB connect failure~~ — done (`app.js`, `index.js`)
- [x] ~~Gate demo credentials behind a dev-only flag~~ — done (`import.meta.env.DEV` in `Login.jsx`)
- [x] ~~Resolve the manager/admin work-log gap~~ — done, `POST /api/daily-work-logs` is open to all roles

**Phase 6 backlog is now fully closed** — all 12 original findings plus these two.

---

## Phase 7 — E2E + performance ✅ COMPLETE

- [x] **Five Playwright flows** (login per role, employee timer, manager review/rework,
      blocked, deactivation handover) — `e2e/specs/01`–`05`. 9 tests total (login is
      split into 5 sub-cases). Two full clean runs in a row, ~55s each, against a real
      `mongodb-memory-server` instance standing in for the disposable E2E database.
      Every flow drives the real UI through two independent browser contexts where the
      scenario genuinely needs two people (e.g. a manager and the employee they
      assigned work to) rather than one tab impersonating both.
- [x] **Three real bugs/gaps found and fixed while getting the suite green** (this is
      exactly what E2E is for — proving the pieces are actually wired together, not
      just individually correct):
      1. **`vite preview` was serving a stale build.** Vite inlines `VITE_API_URL` into
         the bundle at BUILD time, not at serve time — passing the env var to the
         `preview` process alone silently served whatever API URL was baked in by
         someone's last manual `npm run build` (typically `localhost:3000`), so every
         request from the E2E frontend "Network Error"'d against the wrong port. Fixed
         by building fresh (`npm run build && npm run preview`) with the same env on
         every E2E run — slower, but this is already the layer where correctness
         matters more than speed. Purely a test-infrastructure fix — no application code
         involved.
      2. **The Phase 2 login rate limiter (10 attempts / 15 min per IP) legitimately
         blocked the E2E suite itself.** The five flows' logins add up across one
         shared backend process and one shared source IP (Playwright's own browser),
         which a real office of ~10 people never does but a full E2E run always does.
         Added a narrow `skip` on `loginLimiter` (`Backend/routes/auth.js`), gated
         behind `DISABLE_LOGIN_RATE_LIMIT=true` — set ONLY in
         `e2e/playwright.config.js`'s backend env, never a `NODE_ENV` check, so nothing
         about the real limiter's production behaviour changed. That behaviour is
         already covered at the integration level (Phase 2) — E2E doesn't need to
         re-prove the limiter works, just not be blocked by it.
      3. Two Playwright strict-mode violations from elements that legitimately render
         more than once at once (a daily task appears in both "Today's Daily Tasks"
         and "My Assigned Tasks"; a blocked task's reason renders in both the info-grid
         badge and the BlockedPanel's own paragraph) — resolved with `.first()`, not by
         changing the app, since both instances are correct UI.
- [x] Assignee/reassignment `<Select>` options matched by an unanchored name regex, not
      an anchored one — the option's accessible name includes the PersonAvatar's
      initials text node before the visible name (e.g. "EE E2E Employee · 6h free").
- [x] **Data-volume fixture** — `tests/perf/seedVolume.js`, ~12,000 tasks spread across
      two years with realistic `history`/`comments` depth on the older third, ~15,000
      work sessions. Bulk-inserted, not built via factories — the point is volume.
- [x] **Measured before touching anything.** A manager's unscoped task list: **54.9MB,
      15.6s, 10 queries** (6 of them against `users`, from populating
      `comments.author`/`history.changedBy` on every row of every list).
- [x] **List/detail split implemented and re-measured.** `GET /api/tasks` now returns
      `historyCount`/`commentCount`/`lastComment` instead of the unbounded arrays; a new
      `GET /api/tasks/:id` serves the full task, populated, for the one place that
      renders it — `TaskDetailModalCore`, which now fetches on open rather than expecting
      the list to have carried everything. `PendingReviewQueue` switched from reading
      `comments[-1]` to the new `lastComment` field. **Payload: 54.9MB → under 16MB
      (measured well under in practice); query count: 10 → 8.** 17 new tests cover the
      split, including that authorization on the new endpoint matches every other
      single-task route and that `reworkCount` (derived from history) survives even
      though history itself is no longer sent.
- [x] **Query-count and index-usage assertions**, budgeted at what was actually measured
      rather than a guess — same ratchet policy as the coverage floors.
- [x] Payload-SIZE and query-COUNT are asserted; wall-clock latency is logged only. Both
      are properties of the code and hold regardless of hardware; timing on a shared
      in-memory MongoDB swung from 1.5s to 50s for the identical request across runs of
      this very suite, which is exactly the flaky gate the rest of this programme has
      been arguing against. Documented inline so the next person doesn't "fix" it by
      asserting on timing again.
---

## Regression backlog ✅ COMPLETE

Six shipped bugs, each locked down by a test that would fail if the bug came back. Not
all of them live under `Backend/tests/regression/` — where a bug is already covered by
a test that belongs somewhere else on its own merits (e.g. the scope mirror contract),
it lives there instead of being duplicated. `Backend/tests/regression/README.md` is the
authoritative map from bug to test; this list was previously left unchecked after that
map was already filled in — corrected here.

- [x] `01` Daily-scope filter hid 14 incomplete daily tasks — `integration/contracts/scope-agreement.test.js`
- [x] `02` Auto-unblock never fired on timer start — `integration/timer.test.js` ("clears the block when the timer is STARTED")
- [x] `03` Daily-task duplication from carry-forward loop ordering — `regression/03-daily-task-duplication.test.js`
- [x] `04` Task status/comment endpoints had no ownership check — `integration/task-authorization.test.js`
- [x] `05` Timer could be started on a coworker's task — `integration/task-authorization.test.js`
- [x] `06` Report ignored manager scoping — `integration/task-authorization.test.js` ("reporting scope")

**Rule from here on: no bug fix merges without a test here.**

---

## Update log

- **2026-08-19** — **Doc audit + the last 2 Phase 6 items + regression backlog
  correction.** Found `docs/testing-progress.md` itself had drifted: several items sat
  unchecked (`[ ]`) even though the narrative elsewhere in this same file, or the actual
  code, already showed them done — Phase 5's 3 sub-items, the 3 cascading-render sites,
  4 of the 6 "Phase 6 leftovers," and the entire "Regression backlog" section (which
  `Backend/tests/regression/README.md` already listed as fully mapped). All corrected
  against the real source, not against each other. Of the 2 items that were genuinely
  open: **provisioning-on-template-save is now fire-and-forget** (your call), and the
  **timer+status write transaction is now implemented** (your call, after investigating
  first) — turned out smaller than flagged, since the real database (MongoDB Atlas) is
  already a replica set and only the test harness needed to change
  (`MongoMemoryServer` → `MongoMemoryReplSet`). New `Backend/utils/transaction.js`,
  wired into `pauseSession`/`resumeSession`/`stopSession` and `updateTaskStatus`'s
  session-stop branch; deliberately left out of the timer-start path, which has its own
  battle-tested non-transactional concurrency design. One new regression test proves the
  atomicity by forcing a version conflict and checking the session wasn't left stopped.
  752 → 753 backend tests, all green; full E2E suite
  re-verified against a real replica-set instance, not just the standalone one from the
  Phase 7 run. CI-on-GitHub verification was offered and explicitly deferred — not
  attempted.
- **2026-08-19** — **Phase 7 COMPLETE — all 5 E2E flows written and green.** Wrote the
  9 Playwright tests across `e2e/specs/01`–`05` (login × 3 roles + logout + bad
  password, employee timer to completion, manager review/rework, blocked/auto-unblock,
  admin deactivation handover), plus `e2e/fixtures/helpers.js` and a `globalSetup`
  (`e2e/fixtures/seed-e2e.js`) so every run reseeds the disposable database
  automatically instead of depending on a manual step first. Verified for real against
  a throwaway `mongodb-memory-server` instance — two clean back-to-back runs, ~55s each
  — not just written and assumed correct. Getting there surfaced two genuine
  test-infrastructure bugs worth knowing about: `vite preview` was silently serving a
  stale build because `VITE_API_URL` only gets inlined at Vite BUILD time, not serve
  time (fixed by building fresh on every E2E run); and the Phase 2 login rate limiter
  legitimately blocked the suite itself, since five flows' worth of logins from one
  shared IP against one shared backend process is exactly the pattern it's designed to
  catch (fixed with a narrow `DISABLE_LOGIN_RATE_LIMIT` skip set only by
  `e2e/playwright.config.js`, never touching real behaviour). Full writeup in the Phase
  7 section above. All 7 phases of the testing programme are now complete; what
  remains is the regression backlog (6 items, tracked separately) and running CI on
  GitHub for the first time.
- **2026-08-18** — **Phase 7: payload trim done and measured.** Built a two-year data-volume fixture, measured the real cost BEFORE changing anything (54.9MB / 15.6s / 10 queries for a manager's task list), then split list vs detail: `GET /api/tasks` sends summaries, `GET /api/tasks/:id` serves the full task on demand. Frontend's detail modal now fetches on open. Re-measured after: payload and query count both dropped. Restructured the perf assertions around size and query count rather than wall-clock time, after watching the SAME request take between 1.5s and 50s across repeated runs on a shared in-memory MongoDB — asserting on that would have been the flaky gate this whole programme has been built to avoid. One query-count budget corrected from a pre-measurement guess (12) to the actual measured value (13), following the same ratchet policy as the coverage floors. 918 → 935 tests, stable across three consecutive runs in all three timezones.
- **2026-08-18** — **Phase 6 COMPLETE — all 12 findings resolved.** Closed the last one: the Departments report now groups on a *department of record* — the task's own department when set, otherwise the assignee's. It previously grouped purely on `task.department`, which `createTask` leaves null, so real departments read as zero while the Teams report beside it showed the same people under a real team. Falling back rather than ignoring the field keeps the case it exists for: an engineer doing Finance work still counts as Finance. The overdue tally was updated to the same rule, so a department's overdue count matches its own task list. Report-only — no stored task was touched. 918 tests, 4/4 clean across three timezones.
- **2026-08-18** — **Phase 6: 11 of 12.** Opened work-log submission to every role and split "who may submit" from "whose submission do I chase". Encoded the day-attribution rule for tracked hours as an explicit, tested decision rather than an accident of a query filter. **Correction to an earlier claim:** I had reported the report's session filter as a bug that silently dropped time worked inside a date range — it is not. Both consumers filter on `startedAt`, so they were already consistent; under the start-day rule that time belongs to the earlier period and excluding it is correct. The real gap was only that the rule was undocumented and untested. 886 → 915 tests.
- **2026-08-18** — **Phase 6 continued: 9 of 12.** Removed all three cascading renders, writing 11 AuthContext characterisation tests first so the riskiest of them was measured rather than assumed. Added the duplicate-cleanup script the new unique index needs before it can be deployed — and discovered while testing it that the constraint now blocks creating the very duplicates the script exists to remove, so the test drops the index to reproduce a pre-constraint database and restores it afterwards. Also replaced fragile `process.argv` string munging with `pathToFileURL` in both CLI scripts, and stopped linting the coverage output. 886 tests, 4/4 clean across three timezones.
- **2026-08-18** — **Phase 6, first pass: 8 of 12 findings fixed.** Every one was verified by watching its pinned test flip from documenting a gap to asserting an invariant — the mechanism worked exactly as designed on all eight. The timer-race fix needed two attempts: the first narrowed the window but a full-suite run still stranded a task, and the second half turned out to be ordering (pausing a task while it was still "Not Started", where the transition is illegal and silently did nothing). Now 6/6 clean across three timezones. Four items remain, three of which are product decisions rather than defects.
- **2026-08-18** — **Phase 5 complete.** 800 → 859 tests. TimerContext's optimistic rollback paths (97% lines, 95% branches), both mutation hooks, and route gating. Turned the coverage ratchet on in CI with floors set to what is actually achieved. Two test-infrastructure bugs found and fixed along the way: mock call history leaking between tests, and fake timers installed after the interval they were meant to control. All five test phases are now complete; Phase 6 is where the 12 pinned findings get fixed, with the suite standing behind those changes.
- **2026-08-18** — **Phase 4 complete.** 765 → 800 tests. The progress report is now pinned by 35 explicit metric assertions plus two checked-in goldens. Replaced the flaky `it.fails` markers with a retry-based demonstration after measuring a ~13% spurious failure rate, and fixed a bug in my own retry loop that collided on fixed email addresses. Also corrected the task factory, which had been generating tasks whose progress never matched their status. Verified with 10 consecutive full runs rotating through all three timezones, zero failures.
- **2026-08-18** — **Phase 3 complete.** 684 → 765 tests. Full task and timer lifecycles, the concurrency suite, and the last of the regression backfill (all six shipped bugs now covered). Surfaced four real concurrency gaps — optimistic concurrency not holding under true simultaneity, a task left In Progress with no timer, unconstrained duplicate daily-task creation, and a timer startable against Completed work. Three are encoded as `it.fails` markers that flip when fixed; the fourth was too racy to assert reliably, so it asserts the deterministic root cause instead. Also caught a latent weekend-only flake in the provisioning tests before it could bite.
- **2026-08-18** — **Phase 2 complete.** 457 → 684 tests. The full authorization surface: a 36-endpoint × 3-role gating matrix asserted in both directions, per-task ownership across all six single-task routes, visibility scoping, mass-assignment rejection and query-injection handling. Two findings: the query-injection comment described Express 4 behaviour and was wrong for this app's Express 5 (corrected, both vectors now covered), and the test gate itself could pass vacuously on an empty include match (`passWithNoTests: false` now set everywhere and verified).
- **2026-08-18** — **Phase 1 complete.** Scope filtering (100%), the scope mirror contract against a real database, and every frontend lib module. 319 → 457 tests, green in all three timezones. Found and fixed a real bug: `isSelfCreated` read manager-assigned work as self-assigned whenever task refs were unpopulated — latent now, but live the moment Phase 6 trims the list payloads. Seven modules now at 100% lines and branches.
- **2026-08-18** — Phase 1 batch: the workflow state machine, timer arithmetic and calendar/capacity maths, plus three of the four mirror contracts. 43 → 319 tests, green in all three timezones. `config/workflow.js` and `services/taskMetrics.js` both at 100% lines/branches/functions. The contracts surfaced two genuine divergences between the duplicated backend/frontend rules — both pinned by a passing test and queued for Phase 6 rather than fixed mid-phase. `calculateSessionTime` exported from `workSessionController` for the equivalence test (additive, no behaviour change).
- **2026-08-18** — Lint cleanup + `taskMetrics` extraction. Lint went 16 problems / 10 errors → 0 errors (exit 0), with the `set-state-in-effect` downgrade justified by an empirical probe rather than assumption. Extracted 11 metric helpers into `services/taskMetrics.js`, proven character-identical to the original, and covered them with 24 unit tests — the first real product-logic coverage in the repo. Now 43 tests, green in all three timezones; build and full suite verified.
- **2026-08-18** — Phase 0 complete. Harness, fixtures, mocks, utilities, CI workflows and E2E scaffolding built and verified: 19 tests passing, timezone matrix green, server boots after the `app.js` split, coverage enforcement wired. Two defects found and fixed during setup (E2E seed couldn't resolve `mongoose` from the repo root; ESLint had no config for test/config files). Pre-existing lint failures surfaced and flagged, not hidden.
- **2026-08-18** — Testing strategy approved.

*Last updated: 2026-08-19 — all 7 phases, the full Phase 6 backlog, and the regression backlog are complete. Only a first real CI run on GitHub remains, on hold by choice.*
