import { defineConfig, devices } from "@playwright/test"

// E2E is deliberately thin (strategy §4): five flows that prove the pieces are WIRED
// TOGETHER. Permission combinations, metric values and edge cases are covered far
// faster by the backend integration suite and are explicitly out of scope here.
//
// Both servers are started by Playwright against a DISPOSABLE database — never a
// developer's dev database and never production. E2E_MONGODB_URI must point at a
// throwaway instance; e2e/fixtures/seed-e2e.js wipes and reseeds it before each run.

const BACKEND_PORT = process.env.E2E_BACKEND_PORT ?? "3100"
const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT ?? "4173"
const API_URL = `http://localhost:${BACKEND_PORT}`
const APP_URL = `http://localhost:${FRONTEND_PORT}`

// Guard rail, not a convenience: defaulting this to the dev URI is how a test run ends
// up deleting someone's real data.
const MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/progresstracker-e2e"

export default defineConfig({
  testDir: "./specs",
  outputDir: "./.results",
  // Wipes and reseeds the disposable database once, before any spec file runs — see
  // that file's header for why seeding itself lives under Backend/ instead.
  globalSetup: "./fixtures/seed-e2e.js",
  fullyParallel: false, // one seeded database, shared by all specs
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "./.report", open: "never" }]]
    : [["list"]],
  timeout: 30000,
  expect: { timeout: 10000 },

  use: {
    baseURL: APP_URL,
    // Traces and screenshots only for failures — the point is diagnosing a red CI run,
    // not accumulating artefacts from green ones.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],

  webServer: [
    {
      command: "node index.js",
      cwd: "../Backend",
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        PORT: BACKEND_PORT,
        MONGODB_URI,
        NODE_ENV: "production",
        JWT_SECRET: process.env.E2E_JWT_SECRET ?? "e2e-jwt-secret-not-a-real-secret",
        CLIENT_URL: APP_URL,
        // The five flows together log in more times, from one shared IP, against one
        // shared backend process, than the real per-IP login limiter allows — see
        // Backend/routes/auth.js for why this is scoped to exactly this opt-in flag.
        DISABLE_LOGIN_RATE_LIMIT: "true"
      }
    },
    {
      // `vite preview` only serves the existing dist/ folder — it does NOT read
      // VITE_API_URL itself, because Vite inlines env vars into the bundle at BUILD
      // time, not at serve time. Passing the env var to `preview` alone silently
      // serves whatever API URL was baked in by someone's last manual `npm run build`
      // (typically localhost:3000), so every request 404s/CORS-fails against the E2E
      // backend on :3100. Building fresh here, with the same env, is what actually
      // wires the two servers together.
      command: `npm run build && npm run preview -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: "../Frontend",
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: { VITE_API_URL: API_URL }
    }
  ]
})
