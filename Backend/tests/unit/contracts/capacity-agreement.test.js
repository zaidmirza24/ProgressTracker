import { describe, it, expect } from "vitest"
import { getCapacityForDay, getBaseCapacityHours } from "../../../services/calendarService.js"
import { getEmployeeCapacity, getPlannedHoursForDay } from "@frontend/lib/taskHelpers.js"

// MIRROR CONTRACT: the capacity formula exists twice.
//
//   Backend  services/calendarService.js  getCapacityForDay  — what the report, the
//            over-capacity warning on assignment, and every server-side signal use.
//   Frontend lib/taskHelpers.js           getEmployeeCapacity — what the workload bars,
//            the 7-day forecast and the create-task warning banner use.
//
// The frontend keeps its own copy of the RULE (not the data) so an optimistic edit can
// recalculate capacity in the same frame; the DATA always comes from
// GET /api/calendar/context. That only works if the two rules agree.
//
// The failure mode is a manager seeing "6h of 7h planned" in the UI while the API
// refuses the assignment as over capacity — with nothing on screen explaining it.

// Local constructors throughout — see calendarService.test.js for why.
const MON = new Date(2026, 2, 16)
const TUE = new Date(2026, 2, 17)
const SAT = new Date(2026, 2, 14)

const WORKING_DAYS = [1, 2, 3, 4, 5]
const HOLIDAY = { date: new Date(2026, 2, 17), name: "Company Day" }

const EMPLOYEE = { _id: "emp-1", dailyWorkingHours: 8, breakHours: 1 }

// The same facts in each side's own shape.
const settingsFrom = ({ holidays = [] }) => ({ workingDays: WORKING_DAYS, holidays })
const calendarFrom = ({ holidays = [], absences = [] }) => ({ workingDays: WORKING_DAYS, holidays, absences })

const leave = (type, start = MON, end = MON) => ({ employee: "emp-1", startDate: start, endDate: end, type })

const CASES = {
  "an ordinary working day": { day: MON, holidays: [], absences: [] },
  "a weekend": { day: SAT, holidays: [], absences: [] },
  "a holiday": { day: TUE, holidays: [HOLIDAY], absences: [] },
  "a day of leave": { day: MON, holidays: [], absences: [leave("leave")] },
  "a day of sick leave": { day: MON, holidays: [], absences: [leave("sick")] },
  "a half day": { day: MON, holidays: [], absences: [leave("half_day")] },
  "a weekend inside a longer absence": {
    day: SAT,
    holidays: [],
    absences: [leave("leave", new Date(2026, 2, 13), TUE)]
  },
  "another employee's absence": {
    day: MON,
    holidays: [],
    absences: [{ employee: "emp-2", startDate: MON, endDate: MON, type: "leave" }]
  }
}

describe("capacity agreement", () => {
  for (const [name, { day, holidays, absences }] of Object.entries(CASES)) {
    it(`agrees on the hours available on ${name}`, () => {
      const backend = getCapacityForDay(EMPLOYEE, day, settingsFrom({ holidays }), absences)
      const frontend = getEmployeeCapacity(EMPLOYEE, [], 0, day, calendarFrom({ holidays, absences }))

      expect(frontend.capacityHours).toBe(backend.hours)
      expect(frontend.isWorkingDay).toBe(backend.isWorkingDay)
      expect(frontend.capacityReason).toBe(backend.reason)
    })
  }

  it("agrees for a part-time employee", () => {
    const partTimer = { _id: "emp-1", dailyWorkingHours: 4, breakHours: 0.5 }
    const backend = getCapacityForDay(partTimer, MON, settingsFrom({}), [])
    const frontend = getEmployeeCapacity(partTimer, [], 0, MON, calendarFrom({}))

    expect(frontend.capacityHours).toBe(backend.hours)
    expect(backend.hours).toBe(3.5)
  })

  it("agrees when the employee record carries no hours at all", () => {
    const bare = { _id: "emp-1" }
    expect(getEmployeeCapacity(bare, [], 0, MON, calendarFrom({})).capacityHours)
      .toBe(getCapacityForDay(bare, MON, settingsFrom({}), []).hours)
    expect(getBaseCapacityHours(bare)).toBe(7)
  })

  it("agrees that a calendar-free call treats every day as a full working day", () => {
    // The frontend renders before GET /api/calendar/context resolves, with no calendar
    // at all. That path must not silently report a weekend as a full working day
    // differently from how the server would with default settings.
    const frontendNoCalendar = getEmployeeCapacity(EMPLOYEE, [], 0, MON, null)
    expect(frontendNoCalendar.capacityHours).toBe(getCapacityForDay(EMPLOYEE, MON, settingsFrom({}), []).hours)
  })

  it("agrees on the reason when an employee has no configured hours", () => {
    // FIXED in Phase 6. Both sides always agreed there were 0 hours, so no capacity
    // number was wrong and no assignment was wrongly blocked — but the backend said
    // "no_hours_configured" while the frontend said nothing, so the workload bar showed
    // an unexplained 0h where the admin report explained it. The frontend's
    // CAPACITY_REASON_LABELS had the label all along; nothing ever produced it.
    const noHours = { _id: "emp-1", dailyWorkingHours: 0, breakHours: 0 }

    const backend = getCapacityForDay(noHours, MON, settingsFrom({}), [])
    const frontend = getEmployeeCapacity(noHours, [], 0, MON, calendarFrom({}))

    expect(frontend.capacityHours).toBe(backend.hours)
    expect(frontend.capacityReason).toBe(backend.reason)
    expect(backend.reason).toBe("no_hours_configured")
  })

  it("agrees when breaks are configured longer than the working day", () => {
    // Another route to zero base capacity — it must report the same reason.
    const overBooked = { _id: "emp-1", dailyWorkingHours: 2, breakHours: 5 }

    const backend = getCapacityForDay(overBooked, MON, settingsFrom({}), [])
    const frontend = getEmployeeCapacity(overBooked, [], 0, MON, calendarFrom({}))

    expect(frontend.capacityHours).toBe(0)
    expect(frontend.capacityReason).toBe(backend.reason)
  })
})

describe("planned hours agreement", () => {
  // The frontend sums planned hours itself; the backend does the same inside
  // checkCapacityWarning. Both must count the same tasks or the over-capacity warning
  // fires in one place and not the other.
  const tasksFor = (assignee) => [
    { assignedTo: assignee, status: "Not Started", isDaily: true, dailyDate: MON, estimatedHours: 2 },
    { assignedTo: assignee, status: "In Progress", isDaily: false, dueDate: MON, estimatedHours: 3 },
    { assignedTo: assignee, status: "Completed", isDaily: false, dueDate: MON, estimatedHours: 4 },
    { assignedTo: assignee, status: "Not Started", isDaily: false, dueDate: TUE, estimatedHours: 5 },
    { assignedTo: assignee, status: "Not Started", isDaily: false, dueDate: null, estimatedHours: 6 }
  ]

  it("counts open daily and assigned work landing on the day, and nothing else", () => {
    // 2 (daily today) + 3 (assigned today) = 5. Completed work is excluded because
    // capacity is driven by REMAINING estimate (Locked Logic §6); other days and
    // undated work are excluded because they do not land today.
    expect(getPlannedHoursForDay(tasksFor("emp-1"), "emp-1", MON)).toBe(5)
  })

  it("excludes another employee's work", () => {
    expect(getPlannedHoursForDay(tasksFor("emp-2"), "emp-1", MON)).toBe(0)
  })

  it("feeds the same figure into the over-capacity decision as the backend uses", () => {
    // 5h planned against 7h capacity is not over; adding a 3h task makes it over.
    const tasks = tasksFor("emp-1")
    const calendar = calendarFrom({})

    expect(getEmployeeCapacity(EMPLOYEE, tasks, 0, MON, calendar).isOverCapacity).toBe(false)
    expect(getEmployeeCapacity(EMPLOYEE, tasks, 3, MON, calendar).isOverCapacity).toBe(true)
  })

  it("treats any planned work on a zero-capacity day as over capacity", () => {
    // A task due on someone's leave day is precisely what a manager needs flagged.
    const onLeave = calendarFrom({ absences: [leave("leave")] })
    expect(getEmployeeCapacity(EMPLOYEE, tasksFor("emp-1"), 0, MON, onLeave).isOverCapacity).toBe(true)
  })
})
