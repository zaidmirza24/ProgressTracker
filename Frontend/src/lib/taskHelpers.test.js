import { describe, it, expect, afterEach } from "vitest"
import {
  isSelfCreated,
  isTaskOverdue,
  getPlannedHoursForDay,
  getCapacityForecast,
  getNextWorkingDay,
  getTomorrowDateString,
  formatDayLabel,
  isWorkingDay,
  isHolidayOn,
  getAbsenceOn,
  CAPACITY_REASON_LABELS
} from "./taskHelpers"
import { freezeTime, restoreTime } from "../tests/clock"

// The frontend's own copy of the capacity and working-day RULES. It holds the rules,
// never the data — working days, holidays and absences all come from
// GET /api/calendar/context, so the two sides cannot disagree about facts.
//
// Agreement with the server's implementation is asserted in
// Backend/tests/unit/contracts/capacity-agreement.test.js. This file covers the
// helpers that have no server-side counterpart.

const MON = new Date(2026, 2, 16)
const TUE = new Date(2026, 2, 17)
const FRI = new Date(2026, 2, 13)
const SAT = new Date(2026, 2, 14)

const CALENDAR = { workingDays: [1, 2, 3, 4, 5], holidays: [], absences: [] }

describe("isSelfCreated", () => {
  it("is true when a task was assigned by its own assignee", () => {
    // The distinction the whole workflow turns on: self-assigned work skips review.
    expect(isSelfCreated({ assignedBy: { _id: "u1" }, assignedTo: { _id: "u1" } })).toBe(true)
  })

  it("is false for manager-assigned work", () => {
    expect(isSelfCreated({ assignedBy: { _id: "mgr" }, assignedTo: { _id: "u1" } })).toBe(false)
  })

  it("works with unpopulated id references too", () => {
    // REGRESSION: the original implementation compared `assignedBy?._id` to
    // `assignedTo?._id` first, which on an unpopulated task is `undefined === undefined`
    // — always true — so the string fallback beside it never ran and every
    // manager-assigned task read as self-assigned. Latent while list endpoints populate
    // these refs, but live the moment a lean or projected payload is introduced.
    expect(isSelfCreated({ assignedBy: "u1", assignedTo: "u1" })).toBe(true)
    expect(isSelfCreated({ assignedBy: "mgr", assignedTo: "u1" })).toBe(false)
  })

  it("does not call a task with no assignment data self-created", () => {
    // Safe default: the review-gated flow. Treating it as self-assigned would offer an
    // employee a "Completed" transition the server rejects.
    expect(isSelfCreated({})).toBe(false)
    expect(isSelfCreated({ assignedBy: null, assignedTo: null })).toBe(false)
  })

  it("matches a populated ref against a raw id on the other side", () => {
    // Optimistic updates can leave one side populated and the other a bare id.
    expect(isSelfCreated({ assignedBy: { _id: "u1" }, assignedTo: "u1" })).toBe(true)
    expect(isSelfCreated({ assignedBy: "u1", assignedTo: { _id: "u1" } })).toBe(true)
  })
})

describe("isTaskOverdue", () => {
  afterEach(() => restoreTime())

  it("is true for open work past its due date", () => {
    freezeTime("2026-03-16T14:00:00")
    expect(isTaskOverdue({ dueDate: new Date(2026, 2, 10), status: "In Progress" })).toBe(true)
  })

  it("is false once the work is completed", () => {
    // Overdue is a signal about outstanding work, not a permanent mark on the record.
    freezeTime("2026-03-16T14:00:00")
    expect(isTaskOverdue({ dueDate: new Date(2026, 2, 10), status: "Completed" })).toBe(false)
  })

  it("is false for work not yet due", () => {
    freezeTime("2026-03-16T14:00:00")
    expect(isTaskOverdue({ dueDate: new Date(2026, 2, 20), status: "Not Started" })).toBe(false)
  })

  it("is false for work with no due date", () => {
    freezeTime("2026-03-16T14:00:00")
    expect(isTaskOverdue({ status: "Not Started" })).toBe(false)
    expect(isTaskOverdue({ dueDate: null, status: "Not Started" })).toBe(false)
  })
})

describe("working-day helpers", () => {
  it("treats every day as workable before the calendar has loaded", () => {
    // The dashboard renders before GET /api/calendar/context resolves. Showing a
    // weekend as zero-capacity only once the response lands would be worse than
    // assuming a normal day for one frame.
    expect(isWorkingDay(SAT, null)).toBe(true)
    expect(isWorkingDay(SAT, CALENDAR)).toBe(false)
  })

  it("recognises a holiday", () => {
    const withHoliday = { ...CALENDAR, holidays: [{ date: TUE, name: "Company Day" }] }
    expect(isHolidayOn(TUE, withHoliday)).toBe(true)
    expect(isWorkingDay(TUE, withHoliday)).toBe(false)
    expect(isHolidayOn(MON, withHoliday)).toBe(false)
  })

  it("finds an absence covering a day, inclusive of both ends", () => {
    const calendar = {
      ...CALENDAR,
      absences: [{ employee: "emp-1", startDate: MON, endDate: TUE, type: "leave" }]
    }
    expect(getAbsenceOn("emp-1", MON, calendar)).toBeTruthy()
    expect(getAbsenceOn("emp-1", TUE, calendar)).toBeTruthy()
    expect(getAbsenceOn("emp-1", new Date(2026, 2, 18), calendar)).toBeNull()
    expect(getAbsenceOn("emp-2", MON, calendar)).toBeNull()
  })

  it("matches an absence whose employee reference is populated", () => {
    // Absences arrive populated from GET /api/calendar/absences and raw from /context.
    const calendar = {
      ...CALENDAR,
      absences: [{ employee: { _id: "emp-1", name: "Ana" }, startDate: MON, endDate: MON, type: "leave" }]
    }
    expect(getAbsenceOn("emp-1", MON, calendar)).toBeTruthy()
  })
})

describe("getNextWorkingDay / getTomorrowDateString", () => {
  it("skips the weekend", () => {
    // Moving a task to "tomorrow" from a Friday must not land it on a Saturday — that
    // is not a real reschedule.
    expect(getTomorrowDateString(FRI, CALENDAR)).toBe("2026-03-16")
  })

  it("skips a holiday too", () => {
    const withHoliday = { ...CALENDAR, holidays: [{ date: TUE, name: "Company Day" }] }
    expect(getTomorrowDateString(MON, withHoliday)).toBe("2026-03-18")
  })

  it("falls back to the next calendar day with no calendar loaded", () => {
    expect(getTomorrowDateString(FRI, null)).toBe("2026-03-14")
  })

  it("is always strictly after the given day", () => {
    expect(getNextWorkingDay(MON, CALENDAR).getTime()).toBeGreaterThan(MON.getTime())
  })

  it("formats a date string for a confirmation message", () => {
    expect(formatDayLabel("2026-03-16")).toContain("Mar")
    expect(formatDayLabel("2026-03-16")).toContain("16")
  })
})

describe("getPlannedHoursForDay", () => {
  const tasks = [
    { assignedTo: { _id: "emp-1" }, status: "Not Started", isDaily: true, dailyDate: MON, estimatedHours: 2 },
    { assignedTo: "emp-1", status: "In Progress", isDaily: false, dueDate: MON, estimatedHours: 3 },
    { assignedTo: "emp-1", status: "Completed", isDaily: false, dueDate: MON, estimatedHours: 4 },
    { assignedTo: "emp-1", status: "Not Started", isDaily: false, dueDate: null, estimatedHours: 6 }
  ]

  it("sums remaining estimates for work landing on the day", () => {
    // Driven by remaining ESTIMATE, not time already logged (Locked Logic §6).
    expect(getPlannedHoursForDay(tasks, "emp-1", MON)).toBe(5)
  })

  it("ignores undated work and other days", () => {
    expect(getPlannedHoursForDay(tasks, "emp-1", TUE)).toBe(0)
  })

  it("treats a missing estimate as zero rather than breaking the sum", () => {
    const noEstimate = [{ assignedTo: "emp-1", status: "Not Started", dueDate: MON }]
    expect(getPlannedHoursForDay(noEstimate, "emp-1", MON)).toBe(0)
  })
})

describe("getCapacityForecast", () => {
  const employee = { _id: "emp-1", dailyWorkingHours: 8, breakHours: 1 }

  it("returns one entry per day, starting from the given date", () => {
    const forecast = getCapacityForecast(employee, [], 7, MON, CALENDAR)
    expect(forecast).toHaveLength(7)
    expect(forecast[0].date.getDate()).toBe(16)
    expect(forecast[6].date.getDate()).toBe(22)
  })

  it("applies the calendar to each day independently", () => {
    const forecast = getCapacityForecast(employee, [], 7, MON, CALENDAR)
    const saturday = forecast.find(d => d.date.getDay() === 6)
    expect(saturday.capacityHours).toBe(0)
    expect(saturday.capacityReason).toBe("weekend")
    expect(forecast[0].capacityHours).toBe(7)
  })

  it("flags a future day that is already over capacity", () => {
    // The point of the forecast: spot an overload before assigning into it.
    const tasks = [{ assignedTo: "emp-1", status: "Not Started", dueDate: TUE, estimatedHours: 9 }]
    const forecast = getCapacityForecast(employee, tasks, 7, MON, CALENDAR)
    expect(forecast[1].isOverCapacity).toBe(true)
    expect(forecast[0].isOverCapacity).toBe(false)
  })
})

describe("CAPACITY_REASON_LABELS", () => {
  it("has a human label for every reason the server can return", () => {
    // calendarService returns: weekend | holiday | leave | half_day | no_hours_configured
    for (const reason of ["weekend", "holiday", "leave", "sick", "half_day", "no_hours_configured"]) {
      expect(CAPACITY_REASON_LABELS[reason]).toBeTruthy()
    }
  })
})
