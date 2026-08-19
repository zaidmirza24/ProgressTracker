import mongoose from "mongoose"

const DailyWorkLogSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    // Start-of-day boundary for `date`, set once at creation. Exists purely to give
    // the one-log-per-employee-per-day rule (Iteration 5) a real DB-level uniqueness
    // constraint — `date` carries a time component, so a plain index on it can't
    // collapse to "the same calendar day." Logs created before this field existed are
    // excluded from the index below via partialFilterExpression rather than backfilled,
    // so this doesn't touch existing production data (Standards §35).
    logDate: { type: Date },
    todaysWork: { type: String, required: true, trim: true },
    hoursWorked: { type: Number, required: true },
    tasksCompleted: { type: String, trim: true, default: "" },
    problemsFaced: { type: String, trim: true, default: "" },
    nextPlan: { type: String, trim: true, default: "" },
    remarks: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
)

DailyWorkLogSchema.index(
  { employee: 1, logDate: 1 },
  { unique: true, partialFilterExpression: { logDate: { $exists: true } } }
)

const DailyWorkLog = mongoose.model("DailyWorkLog", DailyWorkLogSchema)

export default DailyWorkLog
