import mongoose from "mongoose"
import User from "../../models/User.js"
import Department from "../../models/Department.js"
import Team from "../../models/Team.js"
import Task from "../../models/Task.js"
import WorkSession from "../../models/WorkSession.js"
import { testPasswordHash } from "../factories/user.js"

// Two years of realistic use, built with bulk inserts rather than factories — the point
// is volume, and 12,000 documents one save() at a time would dominate the run.
//
// The shape matters more than the count. Task.history and Task.comments are UNBOUNDED
// arrays that grow for as long as a task is worked on, and both are fully populated on
// every list request. A fixture of 12,000 pristine tasks would prove nothing; the older
// ones here carry the long histories that real tasks accumulate.

const HOUR = 3600
const oid = () => new mongoose.Types.ObjectId()

const DEFAULTS = {
  users: 15,
  tasks: 12000,
  sessions: 15000,
  // Fraction of tasks that are old enough to have accumulated a long tail.
  heavyFraction: 0.2,
  heavyHistory: 40,
  heavyComments: 15
}

export const seedVolume = async (options = {}) => {
  const cfg = { ...DEFAULTS, ...options }

  // Self-contained: each suite clears and rebuilds, because the perf setup deliberately
  // does not clear between tests and the fixed email addresses below would otherwise
  // collide on the second call.
  await Promise.all(
    Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
  )

  // Self-contained: each suite clears and rebuilds, because the perf setup deliberately
  // does not clear between tests and the fixed email addresses below would otherwise
  // collide on the second call.
  await Promise.all(
    Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
  )
  const passwordHash = await testPasswordHash()

  const department = await Department.create({ name: "Engineering" })
  const team = await Team.create({ name: "Platform", department: department._id })

  const manager = await User.create({
    name: "Volume Manager", email: "volume-manager@test.local", passwordHash,
    role: "manager", department: department._id, team: team._id
  })
  const admin = await User.create({
    name: "Volume Admin", email: "volume-admin@test.local", passwordHash,
    role: "super_admin", department: department._id, team: team._id
  })

  const employees = await User.insertMany(
    Array.from({ length: cfg.users }, (_, i) => ({
      _id: oid(),
      name: `Volume Employee ${i}`,
      email: `volume-${i}@test.local`,
      passwordHash,
      role: "employee",
      manager: manager._id,
      department: department._id,
      team: team._id,
      dailyWorkingHours: 8,
      breakHours: 1
    }))
  )

  const now = Date.now()
  const day = 24 * 60 * 60 * 1000
  const statuses = ["Not Started", "In Progress", "Pending", "In Review", "Completed"]

  const taskDocs = []
  for (let i = 0; i < cfg.tasks; i++) {
    const owner = employees[i % employees.length]
    const ageDays = Math.floor((i / cfg.tasks) * 730)     // spread across two years
    const createdAt = new Date(now - ageDays * day)
    const isHeavy = i < cfg.tasks * cfg.heavyFraction     // the oldest slice
    const status = statuses[i % statuses.length]

    taskDocs.push({
      _id: oid(),
      title: `Volume task ${i}`,
      description: "Seeded for the data-volume budgets.",
      category: "General",
      department: department._id,
      assignedBy: i % 3 === 0 ? owner._id : manager._id,
      assignedTo: owner._id,
      priority: ["low", "medium", "high"][i % 3],
      estimatedHours: (i % 5) + 1,
      dueDate: new Date(now - (ageDays - 3) * day),
      status,
      progressPercentage: status === "Completed" ? 100 : 50,
      isActive: true,
      isDaily: i % 7 === 0,
      dailyDate: i % 7 === 0 ? createdAt : null,
      comments: Array.from({ length: isHeavy ? cfg.heavyComments : 1 }, (_, c) => ({
        text: `Comment ${c} on task ${i}. Long enough to be representative of real notes people leave.`,
        author: owner._id,
        createdAt
      })),
      history: Array.from({ length: isHeavy ? cfg.heavyHistory : 2 }, (_, h) => ({
        fromStatus: statuses[h % statuses.length],
        toStatus: statuses[(h + 1) % statuses.length],
        changedBy: h % 2 === 0 ? owner._id : manager._id,
        comment: "Status changed.",
        timestamp: createdAt
      })),
      createdAt,
      updatedAt: createdAt
    })
  }

  // Chunked so a single insert does not exceed the driver's batch limits.
  for (let i = 0; i < taskDocs.length; i += 2000) {
    await Task.insertMany(taskDocs.slice(i, i + 2000), { ordered: false })
  }

  const sessionDocs = []
  for (let i = 0; i < cfg.sessions; i++) {
    const task = taskDocs[i % taskDocs.length]
    const startedAt = new Date(new Date(task.createdAt).getTime() + (i % 8) * HOUR * 1000)
    sessionDocs.push({
      task: task._id,
      employee: task.assignedTo,
      startedAt,
      events: [],
      // All stopped: an active session per employee would violate the partial unique index.
      stoppedAt: new Date(startedAt.getTime() + HOUR * 1000),
      totalSeconds: HOUR
    })
  }
  for (let i = 0; i < sessionDocs.length; i += 5000) {
    await WorkSession.insertMany(sessionDocs.slice(i, i + 5000), { ordered: false })
  }

  return { admin, manager, employees, department, team, taskCount: taskDocs.length }
}
