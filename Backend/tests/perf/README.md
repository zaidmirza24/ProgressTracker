# Performance tests

Runs nightly, never on a PR. `npm run test:perf` (uses `vitest.perf.config.js`).

At ~10 concurrent users throughput is not the risk, so this layer measures **data
growth**, not request volume. The budgets below are designed to fail today on
`GET /api/tasks` and `GET /api/tasks/report`: both populate `comments.author` and
`history.changedBy` for every task, and those subdocument arrays are unbounded and grow
for as long as the app is in use. Those failing budgets are the acceptance criteria for
the payload-trimming work.

## To be written (P3)

**`seed-volume.js`** — a fixture representing two years of realistic use: ~15 users,
~12,000 tasks, long `history`/`comments` arrays on the oldest, ~40,000 work sessions.

**`budgets.test.js`** — p95 latency and response-size ceilings:

| Endpoint | p95 | Body |
|---|---|---|
| `GET /api/tasks?scope=today` | 400ms | 500KB |
| `GET /api/tasks` (unscoped, as the stores actually call it) | 1.5s | 2MB |
| `GET /api/tasks/report` | 2s | 3MB |
| `GET /api/work-sessions/active` | 100ms | — |
| `POST /api/work-sessions/start` | 200ms | — |

**`query-counts.test.js`** — upper bounds via `helpers/queryCounter.js`, the durable way
to catch N+1: `GET /api/tasks` ≤ 5 queries and `GET /api/tasks/report` ≤ 8 queries
regardless of dataset size; `provisionDailyTasksForAllEmployees` is currently
O(users × templates) — the test records the real number and fails if it grows.

**`index-usage.test.js`** — `winningPlanStage()` must be `IXSCAN`, not `COLLSCAN`, for
the hottest queries.

**`autocannon.mjs`** — 20 connections for 30s against `GET /api/tasks?scope=today` and
`POST /api/work-sessions/start`, asserting zero non-2xx and no unhandled rejections.
Stability, not throughput. Add `autocannon` as a devDependency when this lands.
