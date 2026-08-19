import { beforeAll, afterAll } from "vitest"
import mongoose from "mongoose"
import "./env.js"

import "../../models/User.js"
import "../../models/Department.js"
import "../../models/Team.js"
import "../../models/Task.js"
import "../../models/TaskTemplate.js"
import "../../models/WorkSession.js"
import "../../models/DailyWorkLog.js"
import "../../models/Absence.js"
import "../../models/OrgSettings.js"

// Database wiring for the PERF suite only.
//
// Deliberately NOT tests/setup/testDb.js: that clears every collection before each test,
// which is exactly right for correctness tests and exactly wrong here — the volume
// fixture is seeded once in a `beforeAll` and costs about a minute to build. Clearing
// between tests wipes it, and every request then 401s because the users are gone.
//
// Each suite instead clears and re-seeds inside its own `beforeAll`, via seedVolume.

const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "1"

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI
  if (!uri) throw new Error("MONGO_TEST_URI is not set — perf runs need the in-memory MongoDB.")

  await mongoose.connect(uri, { dbName: `pt-perf-${workerId}` })
  await Promise.all(Object.values(mongoose.models).map(model => model.syncIndexes()))
})

afterAll(async () => {
  await mongoose.disconnect()
})
