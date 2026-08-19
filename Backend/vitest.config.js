import path from "path"
import { defineConfig } from "vitest/config"

// Full backend suite: unit + integration + regression, against a real in-memory
// MongoDB (see tests/setup/globalSetup.js).
//
// For the fast inner loop use vitest.unit.config.js, which skips the database
// entirely — see package.json's `test:unit` / `test:watch` scripts.

// Per-directory coverage floors from the testing strategy (§8). They are only
// ENFORCED when COVERAGE_ENFORCE=1, so the floors can be raised phase by phase as
// suites land rather than failing every run until the suite is complete. CI turns
// this on for the branches whose suites have shipped.
const coverageThresholds = {
  // RATCHET POLICY: these are the levels ACTUALLY ACHIEVED as of Phase 5, not
  // aspirations. They may only ever move up — a change that drops any group below its
  // floor fails CI. Raise them as later phases land; never lower one to make a build
  // pass.
  //
  // The strategy's long-term targets are higher (services 95/90, controllers 80/70).
  // The remaining gap is mostly code that Phase 6's hardening will touch anyway, plus
  // error branches that need fault injection to reach.
  "config/workflow.js": { lines: 100, branches: 100, functions: 100, statements: 100 },
  "services/**": { lines: 80, branches: 85, functions: 80, statements: 80 },
  "middleware/**": { lines: 75, branches: 70, functions: 50, statements: 70 },
  "controllers/taskController.js": { lines: 90, branches: 75, functions: 90, statements: 90 },
  "controllers/**": { lines: 75, branches: 60, functions: 85, statements: 75 }
}

export default defineConfig({
  resolve: {
    alias: {
      // The mirror-contract tests (strategy §2) deliberately import the frontend's
      // copies of rules that exist on both sides — scope, capacity, workflow — and
      // assert the two implementations agree. Those modules are dependency-free
      // pure ESM, so they load directly with no build step.
      "@frontend": path.resolve(import.meta.dirname, "../Frontend/src")
    }
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.js"],
    // A suite that matches no files must FAIL, not pass silently. Vitest exits 0 by
    // default when nothing matches, so a broken include pattern, a bad --project flag or
    // a mis-mounted volume in CI would turn the whole gate green while running nothing.
    passWithNoTests: false,
    exclude: ["tests/perf/**", "node_modules/**"],
    globalSetup: ["./tests/setup/globalSetup.js"],
    setupFiles: ["./tests/setup/testDb.js"],
    // Each worker gets its own database inside the shared mongod (see testDb.js), so
    // files can still run in parallel without clearing each other's collections.
    pool: "forks",
    testTimeout: 15000,
    hookTimeout: 30000,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["config/**", "controllers/**", "middleware/**", "models/**", "services/**", "utils/**", "app.js"],
      exclude: ["seed.js", "index.js", "tests/**"],
      ...(process.env.COVERAGE_ENFORCE === "1" && { thresholds: coverageThresholds })
    }
  }
})
