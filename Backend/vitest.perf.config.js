import path from "path"
import { defineConfig } from "vitest/config"

// Data-volume, query-count and index-usage checks (strategy §6).
//
// Kept out of the default run and out of the PR gate: seeding two years of realistic
// history takes far too long for a pre-merge check, and the budgets are about slow
// growth over months, not about whether this particular commit is correct. CI runs
// this nightly.
//
// The premise is that at ~10 users, throughput is not the risk — unbounded
// Task.history/Task.comments arrays being populated on every list request is.

export default defineConfig({
  resolve: {
    alias: {
      "@frontend": path.resolve(import.meta.dirname, "../Frontend/src")
    }
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/perf/**/*.test.js"],
    passWithNoTests: false,
    globalSetup: ["./tests/setup/globalSetup.js"],
    setupFiles: ["./tests/setup/perfDb.js"],
    pool: "forks",
    // Volume fixtures are large and must not be built concurrently by several workers.
    fileParallelism: false,
    testTimeout: 300000,
    hookTimeout: 300000
  }
})
