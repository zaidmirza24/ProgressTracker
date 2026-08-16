# Phase 2 — Work Calendar, Holidays & Absence

*Implements P0 item 2 of `docs/product-gap-solutions.md`.*
**Status: CODE COMPLETE — COMPILES CLEAN, BEHAVIOUR UNVERIFIED (2026-08-16)**

Static checks all pass:
- `node --check` on all 9 changed/new backend files — OK
- Backend import resolution (every named export actually exists) — OK for all 7 modules
- `npm run lint` — **0 issues in Phase 2 files**; total back to the pre-Phase-2 baseline of 16,
  all pre-existing in files this phase didn't touch
- `npm run build` — passes, 3005 modules transformed

One real defect was caught and fixed by lint: `WorkCalendarTab` seeded its edit state from a
`useEffect`, tripping the repo's `react-hooks/set-state-in-effect` rule. Restructured into an
outer shell (fetch/loading/error) plus a `WorkCalendarEditor` child that is only mounted once the
data exists and initialises state directly from props — no seeding effect at all.

**Still unverified:** no runtime behaviour, no API call, no database write, nothing clicked. The
checklist at the bottom of this document is untouched.

---

## The problem

Daily tasks were provisioned every calendar day and capacity was `workingHours − breaks` on
Saturdays, Sundays and public holidays alike. There was no concept of leave. So every weekend
inflated carry-forwards, deflated completion rates, aged pending backlogs, and reported the whole
team as idle — the *inputs* to every signal in the product were wrong.

---

## What was built

### New backend files

| File | Purpose |
|---|---|
| `models/OrgSettings.js` | Singleton: `workingDays[]` (default Mon–Fri), `holidays[{date,name}]`, `timezone`. Lazily self-creates on first read, so no seed or migration step |
| `models/Absence.js` | `employee`, inclusive `startDate`/`endDate`, `type` (leave/sick/holiday/half_day), `reason`, `createdBy`, `isActive` soft-delete. Indexed for day lookups |
| `services/calendarService.js` | **The single source of truth.** `isWorkingDay`, `getCapacityForDay`, `getNextWorkingDay`, `workingDaysBetween`, absence lookups, plus a 60s in-memory settings cache invalidated on write |
| `controllers/calendarController.js` | Context, settings, absence CRUD — all role-scoped |
| `routes/calendarRoutes.js` | Mounted at `/api/calendar` |

### Modified backend

- **`dailyTaskService.js`** — provisioning now returns early on non-working days and skips absent
  employees (half days still get their tasks). The all-employees loop fetches settings and
  absences once and shares them rather than re-querying per person.
- **`index.js`** — calendar routes mounted; the cron's working-day guard lives in the service so
  both the cron and the login self-heal apply the same rule.
- **`taskController.js`** — `getProgressReport` now takes capacity from `calendarService`
  instead of reimplementing the formula inline. **This removes the duplicate-formula problem
  flagged in the gap analysis** (it previously lived here *and* in `taskHelpers.js`).
  Pending age is now measured in **working days**.

### New API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/calendar/context` | any authenticated; absences role-scoped |
| GET | `/api/calendar/settings` | any authenticated |
| PUT | `/api/calendar/settings` | super_admin |
| GET | `/api/calendar/absences` | scoped |
| POST | `/api/calendar/absences` | manager (own reports) / super_admin |
| DELETE | `/api/calendar/absences/:id` | manager (own reports) / super_admin — soft-delete |

### New frontend files

| File | Purpose |
|---|---|
| `store/useCalendarStore.js` | Calendar context + settings/absence CRUD |
| `components/dashboards/superadmin/WorkCalendarTab.jsx` | Admin: seven weekday toggles + holiday list, with dirty-state tracking |
| `components/dashboards/manager/AbsenceDialog.jsx` | Record/remove time away, opened from the workload card |

### Modified frontend

- **`lib/taskHelpers.js`** — `getEmployeeCapacity` and `getCapacityForecast` take an optional
  `calendar`; added `isWorkingDay`, `getAbsenceOn`, `getNextWorkingDay`, `CAPACITY_REASON_LABELS`.
  The frontend keeps its own copy of the *rule* (so optimistic edits recalculate instantly) but
  the *data* always comes from the server.
- **`getTomorrowDateString`** now returns the next **working** day — this resolves the
  `TODO(gap-2)` left in Phase 1C.
- **`TeamWorkloadTracker`** — zero-capacity days render neutrally ("Non-working day" / "On leave"),
  never as an alarming empty red bar; a `CalendarOff` button opens the absence dialog; work
  scheduled on a zero-capacity day is called out.
- **`TeamCapacityForecast`** — non-working columns dimmed, unavailable cells inert with `—`.
- **`TaskFormModal` / `ReassignDialog`** — assignee pickers show "on leave"/"holiday" instead of
  "0h free"; a new amber banner warns when the due date falls on the assignee's day off.
- **Five report consumers updated** so `null` utilisation renders as `—`, not `0%`:
  `TeamSignalsPanel`, `EmployeeDrilldownModal`, `MyProgress`, `MyProgressSection`,
  `buildEmployeeSignalSummary`.

---

## Deliberate design decisions

1. **Utilisation returns `null`, not `0`, when capacity is zero.** Nobody is "0% utilised" on a
   Sunday — the question doesn't apply. Several call sites used `?? 0`, which would have
   reintroduced the misleading number; all were changed.
2. **`isCapacityOverrunToday` is forced `false` on non-working days** — twenty minutes of Saturday
   work is not a capacity overrun.
3. **Work planned on a zero-capacity day still counts as over capacity** and is surfaced
   explicitly. That's usually a due date that needs moving, which is exactly the actionable case.
4. **Pending age in working days.** Partially pre-empts Phase 3, which redefines this metric onto
   blocked tasks.
5. **A missing/failed calendar degrades to the old behaviour** (every day a working day) rather
   than breaking the page.
6. **Frontend duplicates the rule, never the data.** The alternative — asking the server for each
   capacity number — would have broken Phase 1's instant optimistic recalculation.

---

## Known gaps

- **Timezone is stored but not applied.** All date comparisons still use server/browser local time,
  consistent with the rest of the app. Proper TZ handling is a wider change (§25) and was not
  attempted here.
- **No employee self-service** — a manager or admin records absence on someone's behalf.
- **Historical weekend tasks are untouched.** The optional cleanup script described in
  `product-gap-solutions.md` §6 was not written or run; existing weekend daily tasks will keep
  skewing historical rates until it is.

---

## What a test pass should cover

1. Weekend / holiday → no daily tasks provisioned; capacity 0; utilisation `—`; forecast dimmed.
2. Full-day absence → capacity 0, no provisioning. Half day → capacity halved, tasks still created.
3. Task due on a non-working day → capacity bar warns "Xh scheduled anyway".
4. "Move to tomorrow" on a Friday → lands on Monday, not Saturday.
5. Overlapping absences rejected (409); range > 90 days rejected; end before start rejected.
6. Manager can only record absence for direct reports; employee cannot record at all.
7. Changing working days → capacity across dashboard, forecast and report all move together
   (this is the check that the de-duplicated formula actually took).
8. Calendar fetch failing → capacity still renders using the pre-calendar assumption.
9. Pending age no longer grows over a weekend.
10. **Regression:** Phase 1 actions (edit / reassign / cancel / move) all still work.
