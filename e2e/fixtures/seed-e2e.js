// Playwright globalSetup — runs once before the whole suite. Wipes and reseeds the
// disposable E2E database so every run starts from the same known cast, regardless of
// what a previous run (or a developer's manual `npm run e2e:seed`) left behind.
//
// The real fixture lives under Backend/ (see that file's header comment for why:
// Node resolves `mongoose` relative to the importing file, not this one). This is
// just the wiring Playwright's `globalSetup` option needs to call it automatically.
import { seedE2E, disconnectE2E } from "../../Backend/tests/e2e/seedE2E.js"

export default async function globalSetup() {
  await seedE2E()
  await disconnectE2E()
}
