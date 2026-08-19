import mongoose from "mongoose"

// Runs `fn` inside a real MongoDB transaction — `session.withTransaction()` retries
// automatically on the driver's own TransientTransactionError (the standard pattern for
// a replica set under contention), and always ends the session whether it commits,
// aborts, or throws.
//
// Requires the backing MongoDB to run as a replica set (even a single-node one) —
// plain standalone instances refuse multi-document transactions outright. The dev/prod
// URI (Backend/.env, MongoDB Atlas) already is one; the test harness's in-memory
// instance was switched to MongoMemoryReplSet for the same reason (see
// tests/setup/globalSetup.js).
//
// `fn` receives the session and must pass `{ session }` on every write it wants
// included — a write without it commits immediately, outside the transaction, same as
// today.
export const runInTransaction = async (fn) => {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await fn(session)
    })
    return result
  } finally {
    await session.endSession()
  }
}
