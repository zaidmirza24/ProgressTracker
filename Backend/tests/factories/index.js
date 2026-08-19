// Barrel for the test factories.
//
// Factories create PERSISTED documents with complete, sensible defaults, so a test
// states only what it is actually about. They are the only supported way to build test
// data — Backend/seed.js is a destructive development utility and must never be used
// by a test.

export { makeUser, makeEmployee, makeManager, makeSuperAdmin, TEST_PASSWORD, testPasswordHash } from "./user.js"
export { makeTask, makeAssignedTask, makeDailyTask, historyEntry, reworkHistory } from "./task.js"
export {
  makeSession,
  makeStoppedSession,
  makeRunningSession,
  makePausedSession,
  makeResumedSession
} from "./session.js"
export {
  makeDepartment,
  makeTeam,
  makeTemplate,
  makeAbsence,
  makeWorkLog,
  setOrgSettings
} from "./orgUnit.js"
export { buildOrg } from "./org.js"
