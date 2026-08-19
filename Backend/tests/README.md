# Backend tests

Implements the approved testing strategy. Read this before adding a test.

## Layout

```
tests/
├── setup/         globalSetup (one in-memory mongod), per-worker DB wiring, env
├── helpers/       api (supertest), auth (tokens), clock (frozen Date), queryCounter
├── factories/     persisted fixtures — the ONLY supported way to build test data
├── unit/          pure functions. No DB, no filesystem, no network.
│   └── contracts/ mirror agreement between duplicated rules (pure ones)
├── integration/   real Express app + real in-memory MongoDB, via supertest
│   └── contracts/ mirror agreement that needs a real Mongo query to evaluate
├── regression/    one file per historical bug — see below
└── perf/          data-volume budgets, query counts, index usage. Nightly only.
```

## The rules

**`tests/unit/` may not touch the database.** That is what keeps `npm run test:unit`
under a few seconds and usable in watch mode. A contract test that needs a real Mongo
query to evaluate a server-side filter belongs in `tests/integration/contracts/`.

**Build data with factories, never with `seed.js`.** `seed.js` is a destructive
development utility that runs `deleteMany({})` against `MONGODB_URI`. Tests use the
per-worker in-memory database and the factories in `tests/factories/`.

**Never use real time.** Anything that reads `Date.now()` or `new Date()` — elapsed
seconds, capacity for a day, overdue, blocked age, carry-forward — must run under
`freezeTime()` from `helpers/clock.js`. Only `Date` is faked; real timers keep working
because the MongoDB driver depends on them.

**Never use random data.** Factories are deterministic. Random values produce flakes
and obscure what a test is actually asserting.

**No test may depend on another test's state.** The database is cleared before every
test and the OrgSettings cache is invalidated with it.

## Regression tests

One file per bug that has actually shipped, named `NN-short-description.test.js`, with
a header comment naming the source (a doc, an iteration, a commit).

**No bug fix merges without a test here that fails before the fix.** Every
"verified against live data (temporary script, not committed)" note in `CLAUDE.md` is a
regression test that was written and then thrown away; this directory is where those
now live permanently.

## Running

```bash
npm run test:unit          # pure functions, no DB, ~1s — use this in watch mode
npm run test:watch         # the above, watching
npm test                   # everything except perf
npm run test:integration   # integration + regression only
npm run test:coverage      # adds a coverage report
npm run test:perf          # volume/N+1/index checks — slow, opt-in
```

The first integration run downloads a ~590MB MongoDB binary to `~/.cache/mongodb-binaries`
and caches it. Subsequent runs start in about a second. CI caches the same directory.

## Coverage floors

Per-directory floors live in `vitest.config.js` and are enforced only when
`COVERAGE_ENFORCE=1`, so they can be raised phase by phase as suites land rather than
failing every run until the suite is complete. Floors may only ever move up.
