import { MongoMemoryReplSet } from "mongodb-memory-server"

// Starts ONE in-memory MongoDB for the entire run and shares it with every worker.
//
// A real mongod — not a mock — because the behaviour under test depends on real
// MongoDB semantics that no mock reproduces: the partial unique index enforcing one
// active timer per employee (models/WorkSession.js), the partial unique index behind
// one work log per person per day (models/DailyWorkLog.js), `$and`/`$or` composition
// in getTasks, the `$group` aggregations behind every tracked-time rollup, and —
// since Backend/utils/transaction.js — multi-document transactions, which a plain
// standalone `mongod` refuses outright. A single-node replica set is the smallest
// topology that actually supports them, matching the real dev/prod database (MongoDB
// Atlas, always a replica set) rather than diverging from it.
//
// Workers do not share a database inside it — testDb.js gives each worker its own,
// so files can run in parallel without clearing each other's collections.

let mongo

export async function setup({ provide }) {
  mongo = await MongoMemoryReplSet.create({
    binary: { version: "7.0.14" },
    replSet: { count: 1, dbName: "progresstracker-test" }
  })

  const uri = mongo.getUri()
  // Provided for tests that want it explicitly; also exported through the environment
  // because that is what survives into forked workers most reliably.
  provide("mongoUri", uri)
  process.env.MONGO_TEST_URI = uri
}

export async function teardown() {
  await mongo?.stop()
}
