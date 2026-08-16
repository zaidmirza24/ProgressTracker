# Phase 4 — Quality / Rework Signal

*Implements P1 item 4 of `docs/product-gap-solutions.md`.*

**Status: CODE COMPLETE — COMPILES CLEAN, BEHAVIOUR UNVERIFIED (2026-08-16)**

- `node --check` on `taskController.js` — OK
- `npm run lint` — 0 issues in Phase 4 files; total 16, unchanged from baseline
- `npm run build` — passes, 3006 modules
- No runtime check, no API call, nothing clicked.

---

## The problem

Locked Logic §9 and §11 both name Quality/Rework as one of the separate signals. Manager rework
was a real, working action (`ApprovalGatingPanel` / `PendingReviewQueue` → In Review → In Progress)
and every instance was already recorded in `task.history`. **Nothing counted it.** A task approved
first time and one bounced back three times looked identical in every report — while
`TeamSignalsPanel` rendered a "Quality" block containing only "Avg Resolution", which is a time
metric, not a quality one.

---

## The key insight: no new state, and it works retroactively

Employees have **no `In Review` transition at all** in `WORKFLOW_RULES` (`employee.manager_assigned`
has no `"In Review"` key). So an `In Review → In Progress` history entry can *only* have been a
manager sending work back — rework is unambiguously identifiable from history with **no role
lookup, no populate, and no new field**.

Consequence: every number below is computable today for every task already in the database.
**Zero migration, and the metrics are meaningful from the moment they ship.**

---

## Definitions (written into the UI, not just the code)

| Metric | Definition |
|---|---|
| `reworkCount` (per task) | Times a manager returned it from In Review |
| `reviewedTaskCount` | **Completed** tasks that ever entered In Review |
| `firstPassApprovalRate` | Reviewed+completed tasks with `reworkCount === 0` ÷ `reviewedTaskCount` |
| `reworkRate` | Reviewed+completed tasks with `reworkCount ≥ 1` ÷ `reviewedTaskCount` |
| `hasQualitySignal` | `reviewedTaskCount ≥ 3` **and** `reworkRate > 50%` |
| `reworkedTasks[]` | `{ _id, title, status, reworkCount, lastFeedback }` — traceability (§10/§12) |

**The denominator is the critical detail.** It counts only *reviewed* tasks. Daily and
self-assigned tasks skip review entirely by design, so including them would drown the rate and
report a permanent ~100% for everyone. An employee with no reviewed work returns `null`, which the
UI renders as **"—"** and labels "no review-gated work yet" — never 0% or 100% (§41).

Small samples are not flagged, mirroring the existing estimation-pattern rule
(`PATTERN_MIN_SAMPLE`).

---

## What changed

### Backend — `controllers/taskController.js` only

- New helpers: `getReworkCount`, `wasEverReviewed`, `getLastReworkFeedback`, plus
  `QUALITY_MIN_SAMPLE` / `QUALITY_THRESHOLD` constants.
- Per-task `reworkCount` added to **both** serialization paths
  (`attachTrackedSecondsToTasks`, `getTaskWithTime`) — history is already loaded on those
  documents, so it costs no extra query.
- Employee report gains `reviewedTaskCount`, `firstPassApprovalRate`, `reworkRate`,
  `hasQualitySignal`, `reworkedTasks[]`.
- Org health report gains `reworkedTasks` (count of tasks that have come back at least once).

**No model change, no new endpoint, no migration.**

### Frontend

| Component | Change |
|---|---|
| `taskFormatters.js` | `formatRework()` → "Reworked ×2"; `formatQualityRate()` → "—" or "X%"; quality sentence added to `buildEmployeeSignalSummary` |
| `PendingReviewQueue` | **Rework badge on review cards** — the highest-value placement: reviewing something that has already bounced twice is a different decision from reviewing a fresh submission |
| `TeamTasksTable`, `TaskDetailModalCore` | Rework badge in the overrun-badge slot |
| `TeamSignalsPanel` | The half-empty **Quality** block now carries First-pass Approval, Rework Rate, and the reviewed-task count; a "Rework" badge appears on the collapsed row when flagged |
| `EmployeesReport` | Summary-level "Rework" badge beside the existing "Pattern" badge |
| `EmployeeDrilldownModal` | Full **Quality & Rework** section, including the specific tasks sent back *and the manager's feedback on each* |
| `MyProgress`, `MyProgressSection` | Personal first-pass rate, framed as information about the work rather than a mark against the person |

`MyProgressSection`'s "Estimation Accuracy" tile was replaced by "First-pass Approval" to keep the
four-tile row at four; estimation accuracy is still on the full `MyProgress` page.

---

## Framing

Every surface follows the tone already established for the estimation-pattern flag: rework is
reported as an observation, with the explicit note that work coming back often reflects unclear
requirements or acceptance criteria as much as the work itself. No ranking, no score, no
composite — the signal stays separate per Locked Logic §11.

---

## Edge cases handled

| Case | Behaviour |
|---|---|
| Employee with zero reviewed tasks | `null` → "—" / "no review-gated work yet". Never 0% or 100% |
| Task reworked 3× then completed | `reworkCount: 3`; counts once against first-pass rate |
| Task reworked but still open | Excluded from the rate (denominator is *completed* reviewed tasks); badge still shows |
| Manager reopens a **Completed** task | That's `Completed → In Progress`, **not** `In Review → In Progress` — correctly not counted as rework |
| Rework then reassignment | Rework attaches to the task, so it follows the new assignee |
| Cancelled task | Excluded via the existing `isActive` filter |
| Old tasks with sparse history | `wasEverReviewed` returns false; they leave the denominator cleanly |
| Fewer than 3 reviewed tasks | Rate shown, but never flagged |

---

## What a test pass should cover

1. Send a task back for rework → badge shows "Reworked ×1" in the review queue, table and modal.
2. Approve it → first-pass rate drops; the task appears under "Tasks sent back" with the feedback.
3. Employee with only daily tasks → "—" everywhere, never 0%.
4. Reopen a *Completed* task → **not** counted as rework.
5. 2 reviewed tasks both reworked → rate shows 100%, but no flag (below min sample).
6. 4 reviewed, 3 reworked → flagged; badge appears in signals panel and employees table.
7. Rework counts appear for *historical* tasks without any migration — the retroactivity claim.
8. **Regression:** approve/rework flow, Phases 1–3 all still work.
