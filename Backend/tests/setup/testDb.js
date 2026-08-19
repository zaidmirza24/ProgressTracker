import { beforeAll, afterAll, beforeEach } from "vitest"
import mongoose from "mongoose"
import "./env.js"

// Importing every model here does two jobs: it registers them on the shared mongoose
// connection (so `ref:` populates resolve regardless of which modules a given test
// happens to import), and it gives syncIndexes below a complete list to build.
import "../../models/User.js"
import "../../models/Department.js"
import "../../models/Team.js"
import "../../models/Task.js"
import "../../models/TaskTemplate.js"
import "../../models/WorkSession.js"
import "../../models/DailyWorkLog.js"
import "../../models/Absence.js"
import "../../models/OrgSettings.js"

import { invalidateSettingsCache } from "../../services/calendarService.js"

// Per-worker database inside the shared mongod. Without this, parallel test files
// would clear one another's collections between tests.
const workerId = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "1"

beforeAll(async () => {
  const uri = process.env.MONGO_TEST_URI
  if (!uri) {
    throw new Error(
      "MONGO_TEST_URI is not set. This suite requires vitest.config.js (which starts " +
      "the in-memory MongoDB via tests/setup/globalSetup.js). Pure unit tests that do " +
      "not need a database should live in tests/unit/ and run under vitest.unit.config.js."
    )
  }

  await mongoose.connect(uri, { dbName: `pt-test-${workerId}` })

  // Build the indexes declared on the schemas. Mongoose's background autoIndex is not
  // awaited, so without this a test could race ahead of the partial unique indexes and
  // see a duplicate write succeed that production would reject.
  await Promise.all(Object.values(mongoose.models).map(model => model.syncIndexes()))
})

beforeEach(async () => {
  // deleteMany rather than dropDatabase: dropping would take the indexes with it, and
  // the uniqueness constraints are part of what is under test.
  await Promise.all(
    Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({}))
  )

  // calendarService memoises OrgSettings for 60s. Left alone, a cached document from a
  // previous test would outlive the collection it came from and silently apply the
  // wrong working days or holidays to the next one.
  invalidateSettingsCache()
})

afterAll(async () => {
  await mongoose.disconnect()
})
