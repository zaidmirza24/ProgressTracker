import path from "path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

// Frontend tests. Deliberately narrow: pure logic in src/lib, the optimistic-rollback
// paths in TimerContext and the mutation hooks, and route gating. Presentational
// dashboard components are excluded by design (strategy §7) — they render props, they
// change every iteration, and their logic is tested where it lives.
//
// Vitest does not merge vite.config.js when a vitest.config.js is present, so the
// plugin and alias are declared again here. Tailwind's plugin is intentionally NOT
// included: it only produces stylesheets, which no test asserts on.

const coverageThresholds = {
  // Levels achieved as of Phase 5; see Backend/vitest.config.js for the ratchet policy.
  // `src/hooks/**` is dragged down by useTaskActions.js, which is dialog-state wiring
  // for the manager surfaces rather than logic — it is covered incidentally by the
  // component behaviour it drives, not directly.
  "src/lib/**": { lines: 80, branches: 75, functions: 85, statements: 80 },
  "src/context/TimerContext.jsx": { lines: 95, branches: 90, functions: 95, statements: 95 },
  "src/hooks/**": { lines: 55, branches: 60, functions: 60, statements: 55 }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") }
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.{js,jsx}"],
    // See Backend/vitest.config.js: an empty match must fail rather than pass vacuously.
    passWithNoTests: false,
    setupFiles: ["./src/tests/setup.js"],
    // The axios double is a module-level set of vi.fn()s created once per test FILE, so
    // without this its call history accumulates across tests in that file and any
    // "was not called" assertion reads the previous test's calls. Clears history only —
    // implementations are re-established by mockApi() inside each test.
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/lib/**", "src/hooks/**", "src/context/**", "src/store/**"],
      // Presentational components, vendored shadcn/Radix primitives, and the app
      // entry point are out of scope — see the strategy's "what should NOT be tested".
      exclude: ["src/components/**", "src/pages/**", "src/main.jsx", "src/tests/**"],
      ...(process.env.COVERAGE_ENFORCE === "1" && { thresholds: coverageThresholds })
    }
  }
})
