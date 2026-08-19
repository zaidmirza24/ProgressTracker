# Phase 5 — Daily-First Views / Task Scope

*Implements P1 item 5 of `docs/product-gap-solutions.md`.*

**Status: CODE COMPLETE — COMPILES CLEAN, BEHAVIOUR UNVERIFIED (2026-08-16)**

- `node --check` + import resolution — OK; `buildScopeFilter` shape spot-checked
- `npm run lint` — 0 issues in Phase 5 files; total 16, unchanged from baseline
- `npm run build` — passes, 3008 modules

---

## The problem

Locked Logic §7 says *"primary view is daily"*, but every task surface showed all-time. The first
number an employee saw each morning was "Assigned Tasks: 143", and the Completed Kanban column
grew without bound.

---

## THE rule to not get wrong

> **"Today" includes overdue open tasks.**

A naive `dueDate === today` filter would hide exactly the work that needs attention and silently
break the overdue signal on the primary screen. A task is in scope when **any** of these hold:

1. it's a daily task stamped for the window
2. it's not completed and due on or before the horizon — **including overdue**
3. it's actively in flight (In Progress / Pending / In Review), whatever its dates
4. it was completed inside the window (today's wins still show)
5. it's blocked — blocked work is waiting on attention by definition

Clause 3 also removes the need for a work-session lookup: starting a timer sets the task to
In Progress, so the currently-timed task is always in scope automatically.

The bias throughout is *never hide actionable work* — when in doubt, a task stays visible.

---

## An architectural constraint that shaped this

**The manager's `tasks` array feeds the capacity bars and the 7-day forecast.** Scoping that fetch
to "today" would starve them of the future-dated tasks they exist to show.

So the two surfaces scope differently, deliberately:

| Surface | How | Why |
|---|---|---|
| Employee dashboard | **Server-side** (`?scope=`) | Nothing on that page needs out-of-scope tasks |
| Manager Team Tasks table | **Client-side** view filter | The store must keep every task for capacity/forecast; the table narrows the view without narrowing the data |

Both apply the same predicate — `Backend/services/taskScopeService.js` and
`Frontend/src/lib/taskScope.js` mirror each other clause for clause. Same pattern as the work
calendar: the rule is duplicated, the data never is.

---

## What changed

### Backend

**New:** `services/taskScopeService.js` — `buildScopeFilter(scope, referenceDate)`, `TASK_SCOPES`.

**`getTasks`** now accepts `scope`, `status`, `assignedTo`, `page`, `limit`:
- Role visibility and scope both need `$or`, which can't be sibling keys — they're combined
  under `$and`. **This was the main correctness risk in the change**: getting it wrong would
  either widen a manager's visibility or silently return nothing.
- `assignedTo` narrows *within* the caller's scope; it can never widen it, since the role
  condition is ANDed alongside.
- Pagination is **opt-in** (only applied when `limit` is passed), so the manager dashboard's
  full-set fetch is untouched.
- Response gains `scope`, and `total`/`page`/`limit` when paginated. `tasks` is unchanged, so
  every existing consumer keeps working.
- Omitting all params reproduces the original all-time behaviour exactly.

### Frontend

**New:** `lib/taskScope.js` (shared predicate, `SCOPE_LABELS`), `components/tasks/ScopeToggle.jsx`
(styled to match the existing Board|List switch, not a new pattern).

**Changed:**
- `useEmployeeDashboardStore` — `scope` state (default `"today"`) + `setScope`, refetching from
  the server.
- `EmployeeDashboard` — toggle beside the Board/List switch; metric cards relabelled to the
  active scope instead of "All-time"; header explains that overdue work always stays visible.
- `TeamTasksTable` — toggle (default `"week"`), scope kept in the URL beside `filter` so a view
  is shareable; count badge reads "12 of 143"; empty state distinguishes "nothing matches this
  filter" from "nothing in this timeframe".

---

## Deliberately NOT done

**Payload slimming + `GET /api/tasks/:id`.** Dropping `comments`/`history` from the list response
would cut it substantially, but `TaskDetailModalCore` renders both straight off the object the
list hands it, and `PendingReviewQueue` reads `t.comments[last].text`. That requires a detail
endpoint and a refetch-on-open, and the two must ship together. Still P2, as planned.

---

## What a test pass should cover

1. **Employee, Today:** shows today's dailies, work due today, everything in flight, today's
   completions — and **overdue open tasks**. This is the one that matters most.
2. Switch to All time → the full historical list returns.
3. A task completed yesterday is absent from Today, present in This week.
4. A running timer's task is always visible regardless of its due date.
5. A blocked task with no due date stays visible in Today.
6. **Manager:** switching scope changes the table but leaves capacity bars and the 7-day forecast
   untouched — this is the check that the client-side decision actually holds.
7. `?scope=today&filter=overdue` — both compose, and the URL is shareable.
8. `?scope=nonsense` → 400 `INVALID_SCOPE` from the API; the UI falls back to its default.
9. **Manager visibility is unchanged** — a manager still sees exactly their own reports' tasks
   and no more (the `$and` restructure is the risk here).
10. **Regression:** Phases 1–4 all still work.
