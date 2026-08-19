import { makeUser } from "./user.js"
import { makeDepartment, makeTeam } from "./orgUnit.js"

/**
 * The standard cast for authorization and reporting tests.
 *
 * The shape is chosen so that every access-control case the app distinguishes has a
 * concrete actor, and so that no test has to invent its own hierarchy (which is how
 * two suites end up disagreeing about what "out of scope" means):
 *
 *   superAdmin                        unrestricted
 *   managerA  ── employeeA1           a manager and their direct report
 *             └─ employeeA2           a PEER of employeeA1 — the "coworker's task" case
 *   managerB  ── employeeB1           a different reporting line — the "out of scope" case
 *   unmanaged                         an employee with no manager at all
 *
 * Everyone shares one department and team, so department/team-scoped behaviour is
 * exercised without a second set of org units; pass overrides for tests that need more.
 */
export const buildOrg = async () => {
  const department = await makeDepartment({ name: "Engineering" })
  const team = await makeTeam({ name: "Platform", department })

  // Emails are fixed rather than sequence-generated so that anything comparing a whole
  // response against a recorded golden stays stable between runs. The per-test database
  // is cleared before every test, so reusing the same addresses is safe.
  const common = { department: department._id, team: team._id }

  const superAdmin = await makeUser({ ...common, role: "super_admin", name: "Sam Admin", email: "sam.admin@test.local" })
  const managerA = await makeUser({ ...common, role: "manager", name: "Mia Manager", email: "mia.manager@test.local" })
  const managerB = await makeUser({ ...common, role: "manager", name: "Marco Manager", email: "marco.manager@test.local" })

  const [employeeA1, employeeA2, employeeB1, unmanaged] = await Promise.all([
    makeUser({ ...common, role: "employee", name: "Ana Employee", email: "ana@test.local", manager: managerA._id }),
    makeUser({ ...common, role: "employee", name: "Ade Employee", email: "ade@test.local", manager: managerA._id }),
    makeUser({ ...common, role: "employee", name: "Bo Employee", email: "bo@test.local", manager: managerB._id }),
    makeUser({ ...common, role: "employee", name: "Uma Unmanaged", email: "uma@test.local" })
  ])

  return {
    department,
    team,
    superAdmin,
    managerA,
    managerB,
    employeeA1,
    employeeA2,
    employeeB1,
    unmanaged,
    /** Every actor, for table-driven authorization matrices. */
    everyone: [superAdmin, managerA, managerB, employeeA1, employeeA2, employeeB1, unmanaged]
  }
}
