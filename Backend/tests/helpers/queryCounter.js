import mongoose from "mongoose"

// Counts the database operations a block of code issues.
//
// This is how N+1 regressions get caught durably (strategy §6.2): asserting an upper
// bound on QUERY COUNT rather than on wall-clock time gives a stable signal that does
// not flake on a slow CI runner, and it fails the moment a `.populate()` or a loop-
// with-a-findOne is added inside a request handler.
//
// Implemented with mongoose's own debug hook, so it observes every operation actually
// sent to the driver — including ones issued deep inside populate().

const buildRecorder = () => {
  const operations = []
  const handler = (collectionName, methodName, ...args) => {
    operations.push({ collection: collectionName, method: methodName, args })
  }
  return { operations, handler }
}

/**
 * Run `fn`, returning both its result and what it asked the database to do.
 *
 *   const { result, count, operations, byCollection } = await countQueries(() =>
 *     asUser(manager).get("/api/tasks")
 *   )
 *   expect(count).toBeLessThanOrEqual(5)
 */
export const countQueries = async (fn) => {
  const { operations, handler } = buildRecorder()
  const previous = mongoose.get("debug")

  mongoose.set("debug", handler)
  try {
    const result = await fn()
    return {
      result,
      count: operations.length,
      operations,
      byCollection: operations.reduce((acc, op) => {
        acc[op.collection] = (acc[op.collection] || 0) + 1
        return acc
      }, {}),
      byMethod: operations.reduce((acc, op) => {
        acc[op.method] = (acc[op.method] || 0) + 1
        return acc
      }, {})
    }
  } finally {
    mongoose.set("debug", previous ?? false)
  }
}

/**
 * The winning query plan for a Mongoose query, for asserting an index is actually
 * used (strategy §6.3):
 *
 *   const stage = await winningPlanStage(Task.find({ assignedTo: id, isActive: true }))
 *   expect(stage).toBe("IXSCAN")
 */
export const winningPlanStage = async (query) => {
  const explained = await query.explain("queryPlanner")
  const plan = (Array.isArray(explained) ? explained[0] : explained)?.queryPlanner?.winningPlan
  // The driver nests the real access stage under a wrapper on newer servers.
  const stage = plan?.queryPlan ?? plan
  let cursor = stage
  while (cursor?.inputStage) cursor = cursor.inputStage
  return cursor?.stage
}
