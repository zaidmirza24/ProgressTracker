import { describe, it, expect } from "vitest"
import {
  startOfDay,
  isSameCalendarDay,
  isHoliday,
  getHoliday,
  isWorkingDay,
  getNextWorkingDay,
  workingDaysBetween,
  getAbsenceForDay,
  getBaseCapacityHours,
  getCapacityForDay
} from "../../../services/calendarService.js"

// The single source of truth for "is this a working day" and "how much capacity does
// this person have". Everything about capacity, utilisation and blocked-age ageing
// derives from here.
//
// DATES ARE BUILT WITH LOCAL CONSTRUCTORS THROUGHOUT — `new Date(2026, 2, 16)`, never
// `new Date("2026-03-16")`. The string form parses as UTC midnight, which is the
// PREVIOUS day in any negative-offset timezone, so a suite written that way passes in
// Asia/Kolkata and fails in America/Los_Angeles. This module does all its comparisons
// in local time, and the CI timezone matrix runs these tests in three offsets.

// March 2026: the 16th is a Monday, the 13th the Friday before, the 14th/15th a weekend.
const MON = new Date(2026, 2, 16)
const TUE = new Date(2026, 2, 17)
const FRI = new Date(2026, 2, 13)
const SAT = new Date(2026, 2, 14)
const SUN = new Date(2026, 2, 15)

const WEEKDAYS = { workingDays: [1, 2, 3, 4, 5], holidays: [] }
const WITH_HOLIDAY = {
  workingDays: [1, 2, 3, 4, 5],
  holidays: [{ date: new Date(2026, 2, 17), name: "Company Day" }]
}

const employee = (overrides = {}) => ({ _id: "emp-1", dailyWorkingHours: 8, breakHours: 1, ...overrides })

describe("startOfDay / isSameCalendarDay", () => {
  it("strips the time component in local time", () => {
    const result = startOfDay(new Date(2026, 2, 16, 23, 59, 59))
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(2)
    expect(result.getDate()).toBe(16)
    expect(result.getHours()).toBe(0)
  })

  it("treats any two times on the same local day as the same day", () => {
    expect(isSameCalendarDay(new Date(2026, 2, 16, 0, 0), new Date(2026, 2, 16, 23, 59))).toBe(true)
  })

  it("separates adjacent days even one minute apart", () => {
    expect(isSameCalendarDay(new Date(2026, 2, 16, 23, 59), new Date(2026, 2, 17, 0, 1))).toBe(false)
  })

  it("does not confuse the same day-of-month in different months or years", () => {
    expect(isSameCalendarDay(new Date(2026, 2, 16), new Date(2026, 3, 16))).toBe(false)
    expect(isSameCalendarDay(new Date(2026, 2, 16), new Date(2025, 2, 16))).toBe(false)
  })
})

describe("isWorkingDay", () => {
  it("counts a configured weekday", () => {
    expect(isWorkingDay(MON, WEEKDAYS)).toBe(true)
  })

  it("excludes days outside the configured working week", () => {
    expect(isWorkingDay(SAT, WEEKDAYS)).toBe(false)
    expect(isWorkingDay(SUN, WEEKDAYS)).toBe(false)
  })

  it("excludes a holiday that falls on a working day", () => {
    expect(isWorkingDay(TUE, WITH_HOLIDAY)).toBe(false)
  })

  it("defaults to Mon–Fri when no settings are supplied", () => {
    expect(isWorkingDay(MON, null)).toBe(true)
    expect(isWorkingDay(SAT, null)).toBe(false)
  })

  it("honours a non-standard working week", () => {
    // An org working Sunday–Thursday, for example.
    const sunToThu = { workingDays: [0, 1, 2, 3, 4], holidays: [] }
    expect(isWorkingDay(SUN, sunToThu)).toBe(true)
    expect(isWorkingDay(FRI, sunToThu)).toBe(false)
  })
})

describe("isHoliday / getHoliday", () => {
  it("matches a holiday regardless of the time of day stored", () => {
    const settings = { workingDays: [1, 2, 3, 4, 5], holidays: [{ date: new Date(2026, 2, 17, 14, 30), name: "Founders Day" }] }
    expect(isHoliday(new Date(2026, 2, 17, 9, 0), settings)).toBe(true)
    expect(getHoliday(new Date(2026, 2, 17, 9, 0), settings).name).toBe("Founders Day")
  })

  it("returns null when the day is not a holiday", () => {
    expect(isHoliday(MON, WITH_HOLIDAY)).toBe(false)
    expect(getHoliday(MON, WITH_HOLIDAY)).toBeNull()
  })

  it("tolerates missing settings or an empty holiday list", () => {
    expect(isHoliday(MON, null)).toBe(false)
    expect(isHoliday(MON, { workingDays: [1] })).toBe(false)
  })
})

describe("getNextWorkingDay", () => {
  it("returns the next day when it is a working day", () => {
    expect(isSameCalendarDay(getNextWorkingDay(MON, WEEKDAYS), TUE)).toBe(true)
  })

  it("skips the weekend", () => {
    // Rescheduling a task onto a Saturday is not a real reschedule.
    expect(isSameCalendarDay(getNextWorkingDay(FRI, WEEKDAYS), MON)).toBe(true)
  })

  it("skips a holiday as well as the weekend", () => {
    // Monday → Tuesday is a holiday → Wednesday.
    expect(isSameCalendarDay(getNextWorkingDay(MON, WITH_HOLIDAY), new Date(2026, 2, 18))).toBe(true)
  })

  it("is strictly after the given day, never the same day", () => {
    expect(isSameCalendarDay(getNextWorkingDay(MON, WEEKDAYS), MON)).toBe(false)
  })

  it("falls back to the next calendar day when no working day exists within two weeks", () => {
    // A misconfigured calendar must not spin forever or return nothing.
    const noWorkingDays = { workingDays: [], holidays: [] }
    expect(isSameCalendarDay(getNextWorkingDay(MON, noWorkingDays), TUE)).toBe(true)
  })
})

describe("workingDaysBetween", () => {
  it("counts a single working day inclusively", () => {
    expect(workingDaysBetween(MON, MON, WEEKDAYS)).toBe(1)
  })

  it("counts both endpoints", () => {
    expect(workingDaysBetween(MON, TUE, WEEKDAYS)).toBe(2)
  })

  it("does not count the weekend", () => {
    // Friday to Monday is two working days, not four calendar days. This is what stops
    // a task blocked over a weekend accruing age nobody could have acted on.
    expect(workingDaysBetween(FRI, MON, WEEKDAYS)).toBe(2)
  })

  it("does not count a holiday", () => {
    // Monday to Wednesday, with Tuesday a holiday.
    expect(workingDaysBetween(MON, new Date(2026, 2, 18), WITH_HOLIDAY)).toBe(2)
  })

  it("returns 0 when the range is reversed", () => {
    expect(workingDaysBetween(TUE, MON, WEEKDAYS)).toBe(0)
  })

  it("returns 0 for a range consisting only of non-working days", () => {
    expect(workingDaysBetween(SAT, SUN, WEEKDAYS)).toBe(0)
  })

  it("ignores the time of day at either end", () => {
    expect(workingDaysBetween(new Date(2026, 2, 16, 23, 0), new Date(2026, 2, 17, 1, 0), WEEKDAYS)).toBe(2)
  })

  it("terminates on an absurd range rather than looping forever", () => {
    // Guarded at 3650 iterations against a corrupt stored timestamp.
    const count = workingDaysBetween(new Date(1990, 0, 1), new Date(2026, 2, 16), WEEKDAYS)
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThanOrEqual(3650)
  })
})

describe("getAbsenceForDay", () => {
  const absence = { employee: "emp-1", startDate: new Date(2026, 2, 16), endDate: new Date(2026, 2, 18), type: "leave" }

  it("matches the first and last day of the range inclusively", () => {
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 16), [absence])).toBe(absence)
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 18), [absence])).toBe(absence)
  })

  it("matches a day inside the range", () => {
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 17), [absence])).toBe(absence)
  })

  it("does not match the day before or after", () => {
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 15), [absence])).toBeNull()
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 19), [absence])).toBeNull()
  })

  it("does not match a different employee", () => {
    expect(getAbsenceForDay("emp-2", new Date(2026, 2, 17), [absence])).toBeNull()
  })

  it("ignores the time of day on the boundaries", () => {
    expect(getAbsenceForDay("emp-1", new Date(2026, 2, 18, 23, 59), [absence])).toBe(absence)
  })

  it("returns null when there are no absences", () => {
    expect(getAbsenceForDay("emp-1", MON, [])).toBeNull()
    expect(getAbsenceForDay("emp-1", MON)).toBeNull()
  })
})

describe("getBaseCapacityHours", () => {
  it("is working hours minus breaks (Locked Logic §6)", () => {
    expect(getBaseCapacityHours({ dailyWorkingHours: 8, breakHours: 1 })).toBe(7)
  })

  it("defaults to 8 hours minus a 1 hour break", () => {
    expect(getBaseCapacityHours({})).toBe(7)
    expect(getBaseCapacityHours(null)).toBe(7)
  })

  it("never goes negative when breaks exceed working hours", () => {
    expect(getBaseCapacityHours({ dailyWorkingHours: 2, breakHours: 5 })).toBe(0)
  })

  it("respects an explicit zero break", () => {
    expect(getBaseCapacityHours({ dailyWorkingHours: 6, breakHours: 0 })).toBe(6)
  })
})

describe("getCapacityForDay", () => {
  it("gives full capacity on an ordinary working day", () => {
    expect(getCapacityForDay(employee(), MON, WEEKDAYS, [])).toMatchObject({
      hours: 7,
      reason: null,
      isWorkingDay: true,
      absence: null
    })
  })

  it("gives no capacity at the weekend, and says why", () => {
    // Callers must render "—" rather than 0%: nobody is 0% utilised on a Sunday.
    expect(getCapacityForDay(employee(), SAT, WEEKDAYS, [])).toMatchObject({
      hours: 0,
      reason: "weekend",
      isWorkingDay: false
    })
  })

  it("gives no capacity on a holiday, and names it", () => {
    expect(getCapacityForDay(employee(), TUE, WITH_HOLIDAY, [])).toMatchObject({
      hours: 0,
      reason: "holiday",
      holidayName: "Company Day",
      isWorkingDay: false
    })
  })

  it("gives no capacity on a day of leave", () => {
    const absences = [{ employee: "emp-1", startDate: MON, endDate: MON, type: "leave" }]
    expect(getCapacityForDay(employee(), MON, WEEKDAYS, absences)).toMatchObject({
      hours: 0,
      reason: "leave",
      isWorkingDay: true
    })
  })

  it("reports sick leave as leave", () => {
    const absences = [{ employee: "emp-1", startDate: MON, endDate: MON, type: "sick" }]
    expect(getCapacityForDay(employee(), MON, WEEKDAYS, absences).reason).toBe("leave")
  })

  it("halves capacity on a half day rather than zeroing it", () => {
    const absences = [{ employee: "emp-1", startDate: MON, endDate: MON, type: "half_day" }]
    expect(getCapacityForDay(employee(), MON, WEEKDAYS, absences)).toMatchObject({
      hours: 3.5,
      reason: "half_day",
      isWorkingDay: true
    })
  })

  it("reports no configured hours distinctly from a day off", () => {
    // Both give 0 hours, but "nobody set your hours" and "it's Sunday" need different
    // messages — the first is a configuration problem someone should fix.
    const noHours = employee({ dailyWorkingHours: 0, breakHours: 0 })
    expect(getCapacityForDay(noHours, MON, WEEKDAYS, [])).toMatchObject({
      hours: 0,
      reason: "no_hours_configured",
      isWorkingDay: true
    })
  })

  it("lets the weekend take precedence over an absence recorded across it", () => {
    // A week of leave spanning a weekend must report the weekend as a weekend, not as
    // leave — otherwise a report explains Saturday as "on leave".
    const absences = [{ employee: "emp-1", startDate: FRI, endDate: TUE, type: "leave" }]
    expect(getCapacityForDay(employee(), SAT, WEEKDAYS, absences).reason).toBe("weekend")
  })

  it("ignores another employee's absence", () => {
    const absences = [{ employee: "emp-2", startDate: MON, endDate: MON, type: "leave" }]
    expect(getCapacityForDay(employee(), MON, WEEKDAYS, absences).hours).toBe(7)
  })

  it("accepts an employee identified by `id` rather than `_id`", () => {
    const absences = [{ employee: "emp-9", startDate: MON, endDate: MON, type: "leave" }]
    const lean = { id: "emp-9", dailyWorkingHours: 8, breakHours: 1 }
    expect(getCapacityForDay(lean, MON, WEEKDAYS, absences).hours).toBe(0)
  })
})
