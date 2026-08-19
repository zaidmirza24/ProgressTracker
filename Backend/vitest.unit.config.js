import path from "path"
import { defineConfig } from "vitest/config"

// Fast inner-loop config: pure functions only. No MongoDB, no globalSetup, no
// per-test database teardown — the whole point is that this stays under a few
// seconds so it can run in watch mode while you work.
//
// The rule that keeps it fast is a rule about the tests, not the config: nothing
// under tests/unit/ may touch the database, the filesystem, or the network. A
// contract test that needs a real Mongo query (e.g. scope-filter agreement) belongs
// in tests/integration/contracts/ instead.

export default defineConfig({
  resolve: {
    alias: {
      "@frontend": path.resolve(import.meta.dirname, "../Frontend/src")
    }
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/unit/**/*.test.js"],
    passWithNoTests: false,
    restoreMocks: true,
    unstubEnvs: true,
    setupFiles: ["./tests/setup/env.js"]
  }
})
