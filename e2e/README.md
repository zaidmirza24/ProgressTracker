# End-to-end tests

**Status: complete — all 5 flows written and passing (Phase 7).**

Browser binaries are NOT downloaded as part of the normal install — run
`npm run e2e:install` once (chromium only, ~150MB) before the first `npm run e2e`. The
disposable database is reseeded automatically at the start of every run (Playwright
`globalSetup`, see `fixtures/seed-e2e.js`) — no manual `npm run e2e:seed` step needed
first, though the script still exists for resetting the database on its own.

## Scope

Five flows, no more. E2E is the slowest and flakiest layer; it exists to prove the
pieces are wired together, not to re-verify logic that the backend integration suite
covers in a fraction of the time.

1. Login as each role → correct dashboard, correct sidebar links.
2. Employee: start timer on a daily task → widget ticks → pause → complete → task shows
   Completed with non-zero tracked time.
3. Manager: create a task for a report → report sees it → submits for review → manager
   returns it for rework → employee sees it back in their workload.
4. Manager marks a task blocked with a reason → badge appears on the employee's board →
   employee starts the timer → badge clears.
5. Admin: deactivate a user with open tasks → handover dialog forces reassignment →
   tasks land on the new assignee.

**Out of scope here:** every permission combination, every metric value, visual
appearance, responsive breakpoints, org-management CRUD variants.

## Database safety

`E2E_MONGODB_URI` must point at a **throwaway** database — the seed fixture wipes every
collection before a run, and refuses to run at all unless the database name contains
`e2e`. It defaults to `progresstracker-e2e` on localhost and must never be set to a dev
or production URI.

The fixture lives at `Backend/tests/e2e/seedE2E.js`, not here: Node resolves `mongoose`
and the models relative to the importing file, so a copy under `e2e/` would need those
packages duplicated as root dependencies. Ownership still belongs to the tests.
`fixtures/seed-e2e.js` is the thin `globalSetup` wrapper that calls it automatically
before every `npm run e2e`; `npm run e2e:seed` remains available to reset the database
on its own, outside a full run.

```bash
npm run e2e:install     # once — downloads chromium
npm run e2e             # headless — seeds automatically, then runs all 5 flows
npm run e2e:ui          # Playwright UI mode
npm run e2e:seed        # optional — reset the disposable database without running tests
```

Playwright starts both servers itself (Backend on 3100, Vite preview on 4173), so the
run does not touch a server you already have open on 3000/5173.
