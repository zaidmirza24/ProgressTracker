# Regression tests

One file per bug that has actually shipped: `NN-short-description.test.js`, with a
header comment naming where it came from and what the fix was.

**Rule: no bug fix merges without a test that fails before the fix.**

Where a shipped bug is already locked down by a test that belongs somewhere else on its
own merits, it lives there rather than being duplicated here — the table below says
where. A regression test's value is that it exists and runs, not which folder it sits in.

## Status

| # | Bug | Source | Covered by |
|---|---|---|---|
| 01 | Scope filter hid 14 incomplete daily tasks when provisioning was behind | `docs/test-results-phases-1-5.md` | `integration/contracts/scope-agreement.test.js` — "never hides an incomplete daily task" |
| 02 | Auto-unblock never fired on timer *start* (only on resume) | `docs/test-results-phases-1-5.md` | `integration/timer.test.js` — "auto-unblock when work resumes", asserting both paths |
| 03 | Daily-task duplication from carry-forward loop ordering | `CLAUDE.md` Iteration 13 | **`03-daily-task-duplication.test.js`** (here) |
| 04 | `updateTaskStatus` / `addComment` had no ownership check | `CLAUDE.md` Iteration 14 | `integration/task-authorization.test.js` — the six-route ownership matrix |
| 05 | `startSession` allowed a timer on a coworker's task | `CLAUDE.md` Iteration 14 | `integration/task-authorization.test.js` — same matrix, "start a timer" row |
| 06 | `getProgressReport` ignored manager scoping | `CLAUDE.md` Iteration 11 | `integration/task-authorization.test.js` — "reporting scope" |

All six are now covered.

## Writing one

Name the bug, not the code path — `03-daily-task-duplication`, not
`03-dailyTaskService`. The header comment should say what went wrong, what the user saw,
and what the fix was, so someone reading it in a year understands why the test exists
without digging through history.
