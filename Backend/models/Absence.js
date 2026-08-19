import mongoose from "mongoose"

// An employee being away for a date range. Modelled as a range rather than a per-day
// flag because that's how leave is actually requested, and a single-day lookup is
// still one indexed query.
//
// Both dates are INCLUSIVE and normalised to start-of-day on write, so a one-day
// absence has startDate === endDate.
const AbsenceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // half_day halves that day's capacity rather than zeroing it. Morning/afternoon is
    // deliberately not modelled — no feature needs the distinction.
    type: {
      type: String,
      enum: ["leave", "sick", "holiday", "half_day"],
      default: "leave"
    },
    reason: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Soft-delete, per Core Rule 2 — a report run over a past period must still be able
    // to explain why capacity was zero that day.
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

// Day lookups filter by employee + range; the calendar context query filters by range
// across all employees.
AbsenceSchema.index({ employee: 1, startDate: 1, endDate: 1 })
AbsenceSchema.index({ isActive: 1, startDate: 1, endDate: 1 })

const Absence = mongoose.model("Absence", AbsenceSchema)

export default Absence
