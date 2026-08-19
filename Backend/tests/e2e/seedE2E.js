import { pathToFileURL } from "url"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import User from "../../models/User.js"
import Department from "../../models/Department.js"
import Team from "../../models/Team.js"
import Task from "../../models/Task.js"
import TaskTemplate from "../../models/TaskTemplate.js"
import WorkSession from "../../models/WorkSession.js"
import DailyWorkLog from "../../models/DailyWorkLog.js"
import Absence from "../../models/Absence.js"
import OrgSettings from "../../models/OrgSettings.js"

// Seeds the disposable E2E database with a known, minimal cast.
//
// Lives under Backend/ rather than e2e/ for a boring but decisive reason: Node resolves
// `mongoose` and the models from the importing FILE's location, not the working
// directory. A copy under e2e/ could only work by duplicating mongoose and bcryptjs as
// root dependencies, which is exactly the kind of avoidable dependency the testing
// strategy rules out. The E2E suite invokes it as a script (see package.json's
// `e2e:seed`); ownership stays with the tests.
//
// Separate from Backend/seed.js on purpose: that script is a development utility whose
// contents change with demo needs, and an E2E suite asserting on it would break every
// time someone adjusted the demo data.
//
// Destructive by design, so it refuses to run against anything that does not look like
// a throwaway E2E database.

export const E2E_PASSWORD = "e2e-password-123"

export const E2E_USERS = {
  admin: "e2e-admin@test.local",
  manager: "e2e-manager@test.local",
  employee: "e2e-employee@test.local",
  peer: "e2e-peer@test.local"
}

export const DEFAULT_E2E_URI = "mongodb://127.0.0.1:27017/progresstracker-e2e"

const assertDisposable = (uri) => {
  if (!/e2e/i.test(uri)) {
    throw new Error(
      `Refusing to seed "${uri}" — this fixture wipes every collection and the URI does ` +
      "not look like a throwaway E2E database (its name must contain \"e2e\")."
    )
  }
}

export const seedE2E = async (uri = process.env.E2E_MONGODB_URI ?? DEFAULT_E2E_URI) => {
  assertDisposable(uri)
  await mongoose.connect(uri)

  await Promise.all([
    User.deleteMany({}), Department.deleteMany({}), Team.deleteMany({}),
    Task.deleteMany({}), TaskTemplate.deleteMany({}), WorkSession.deleteMany({}),
    DailyWorkLog.deleteMany({}), Absence.deleteMany({}), OrgSettings.deleteMany({})
  ])

  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10)
  const department = await Department.create({ name: "E2E Department" })
  const team = await Team.create({ name: "E2E Team", department: department._id })
  const common = { passwordHash, department: department._id, team: team._id }

  const admin = await User.create({ ...common, name: "E2E Admin", email: E2E_USERS.admin, role: "super_admin" })
  const manager = await User.create({ ...common, name: "E2E Manager", email: E2E_USERS.manager, role: "manager" })
  const [employee, peer] = await User.create([
    { ...common, name: "E2E Employee", email: E2E_USERS.employee, role: "employee", manager: manager._id },
    { ...common, name: "E2E Peer", email: E2E_USERS.peer, role: "employee", manager: manager._id }
  ])

  // All seven days are working days so a run on a Saturday still provisions daily
  // tasks — an E2E suite that only passes Monday to Friday is worse than none.
  await OrgSettings.create({ workingDays: [0, 1, 2, 3, 4, 5, 6], holidays: [], timezone: "UTC" })
  await TaskTemplate.create({
    title: "E2E Daily Standup",
    category: "Daily",
    estimatedHours: 1,
    scope: "global",
    createdBy: admin._id
  })

  return { admin, manager, employee, peer, department, team }
}

export const disconnectE2E = () => mongoose.disconnect()

// Run directly: `npm run e2e:seed` (from the repo root) or `node tests/e2e/seedE2E.js`.
// pathToFileURL handles Windows drive letters and spaces; hand-rolled string
// munging of process.argv[1] does not.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  seedE2E()
    .then(async ({ employee }) => {
      console.log(`E2E database seeded (employee: ${employee.email}).`)
      await disconnectE2E()
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
