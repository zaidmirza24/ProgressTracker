import { pathToFileURL } from "url"
import mongoose from "mongoose"
import Task from "../models/Task.js"
import WorkSession from "../models/WorkSession.js"

// One-off cleanup: collapse duplicate active daily tasks so the uniqueness constraint on
// { assignedTo, templateRef, dailyDate } can be built.
//
// WHY THIS IS NEEDED: two separate bugs produced duplicates. The Iteration 13 loop
// ordering created a fresh instance alongside a carried-forward one every day, and the
// provisioning race (findOne-then-create with nothing enforcing uniqueness) could create
// two whenever the midnight cron and a login self-heal overlapped. Both are fixed, but
// the rows they already wrote are still there.
//
// WHY IT MATTERS THAT YOU RUN IT: MongoDB refuses to build a unique index over existing
// duplicates, and Mongoose's automatic index creation does NOT crash on that failure — it
// logs and carries on. The application would come up looking healthy with the constraint
// silently absent, leaving the race open. There is no visible symptom.
//
// WHAT IT KEEPS, per group: the instance with actual work on it (tracked time, or a
// status beyond "Not Started"), falling back to the oldest. That preserves logged effort
// rather than blindly keeping the first row, which is the one risk in the simpler rule.
// Everything else is SOFT-deleted (isActive: false) with an audit entry — Core Rule 2,
// never hard-delete.
//
// Dry run by default. Pass --apply to write.

const scoreOf = (task, trackedByTask) => ({
  hasWork: (trackedByTask.get(task._id.toString()) ?? 0) > 0 || task.status !== "Not Started",
  createdAt: task.createdAt
})

export const findDuplicateGroups = async () => {
  const groups = await Task.aggregate([
    { $match: { isActive: true, isDaily: true, templateRef: { $ne: null } } },
    { $group: {
      _id: { assignedTo: "$assignedTo", templateRef: "$templateRef", dailyDate: "$dailyDate" },
      ids: { $push: "$_id" },
      count: { $sum: 1 }
    } },
    { $match: { count: { $gt: 1 } } }
  ])
  return groups
}

export const dedupeDailyTasks = async ({ apply = false, actorId = null } = {}) => {
  const groups = await findDuplicateGroups()
  const summary = { groups: groups.length, duplicates: 0, kept: [], removed: [] }

  for (const group of groups) {
    const tasks = await Task.find({ _id: { $in: group.ids } })

    // Tracked time decides which instance carries real work.
    const sessions = await WorkSession.aggregate([
      { $match: { task: { $in: group.ids } } },
      { $group: { _id: "$task", total: { $sum: "$totalSeconds" } } }
    ])
    const trackedByTask = new Map(sessions.map(s => [s._id.toString(), s.total]))

    const ranked = [...tasks].sort((a, b) => {
      const sa = scoreOf(a, trackedByTask)
      const sb = scoreOf(b, trackedByTask)
      if (sa.hasWork !== sb.hasWork) return sa.hasWork ? -1 : 1
      return new Date(sa.createdAt) - new Date(sb.createdAt)
    })

    const [keep, ...discard] = ranked
    summary.kept.push({ id: keep._id.toString(), title: keep.title, status: keep.status })
    summary.duplicates += discard.length

    for (const task of discard) {
      summary.removed.push({ id: task._id.toString(), title: task.title, status: task.status })
      if (!apply) continue

      task.isActive = false
      task.history.push({
        changes: [{ field: "isActive", from: "active", to: "cancelled" }],
        changedBy: actorId ?? keep.assignedTo,
        comment: "Removed as a duplicate daily task during cleanup"
      })
      await task.save()
    }
  }

  return summary
}

// pathToFileURL handles Windows drive letters and spaces; hand-rolled string
// munging of process.argv[1] does not.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  const apply = process.argv.includes("--apply")
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

  mongoose.connect(uri)
    .then(async () => {
      const summary = await dedupeDailyTasks({ apply })

      console.log(`\nDuplicate daily tasks — ${apply ? "APPLYING" : "DRY RUN"}`)
      console.log(`  database:            ${uri.replace(/\/\/[^@]*@/, "//***@")}`)
      console.log(`  affected groups:     ${summary.groups}`)
      console.log(`  duplicates to remove:${summary.duplicates}`)
      for (const row of summary.removed) {
        console.log(`    - "${row.title}" (${row.status})`)
      }
      if (!apply && summary.duplicates > 0) {
        console.log("\n  Nothing was written. Re-run with --apply to soft-delete these.")
      }
      if (summary.duplicates === 0) {
        console.log("\n  No duplicates — the unique index can be built safely.")
      }
      await mongoose.disconnect()
    })
    .catch(async (err) => {
      console.error("Cleanup failed:", err.message)
      process.exit(1)
    })
}
