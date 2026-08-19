import bcrypt from "bcryptjs"
import User from "../../models/User.js"

// The password every factory-built user has. Fixed and obviously fake — it exists so
// login tests have something to send, and it is never a real credential.
export const TEST_PASSWORD = "password123"

// bcrypt at cost 10 takes ~100ms. Hashing once per worker instead of once per user
// keeps setup-heavy suites from being dominated by key derivation.
let cachedHash = null
export const testPasswordHash = async () => {
  cachedHash ??= await bcrypt.hash(TEST_PASSWORD, 10)
  return cachedHash
}

let sequence = 0
const nextEmail = (role) => `${role}-${++sequence}@test.local`

/**
 * Create a persisted user. Every field the application reads has a sensible default,
 * so a test only states what it actually cares about:
 *
 *   const employee = await makeUser({ role: "employee", manager: manager._id })
 *   const partTimer = await makeUser({ dailyWorkingHours: 4, breakHours: 0 })
 */
export const makeUser = async (overrides = {}) => {
  const role = overrides.role ?? "employee"
  return User.create({
    name: overrides.name ?? `Test ${role} ${sequence + 1}`,
    email: overrides.email ?? nextEmail(role),
    passwordHash: overrides.passwordHash ?? await testPasswordHash(),
    role,
    department: overrides.department ?? null,
    team: overrides.team ?? null,
    manager: overrides.manager ?? null,
    isActive: overrides.isActive ?? true,
    // Defaults chosen to make capacity arithmetic obvious: 8 − 1 = 7 usable hours.
    dailyWorkingHours: overrides.dailyWorkingHours ?? 8,
    breakHours: overrides.breakHours ?? 1,
    ...(overrides._id && { _id: overrides._id })
  })
}

export const makeEmployee = (overrides = {}) => makeUser({ ...overrides, role: "employee" })
export const makeManager = (overrides = {}) => makeUser({ ...overrides, role: "manager" })
export const makeSuperAdmin = (overrides = {}) => makeUser({ ...overrides, role: "super_admin" })
