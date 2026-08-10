import mongoose from "mongoose"

const DailyWorkLogSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    todaysWork: { type: String, required: true, trim: true },
    hoursWorked: { type: Number, required: true },
    tasksCompleted: { type: String, trim: true, default: "" },
    problemsFaced: { type: String, trim: true, default: "" },
    nextPlan: { type: String, trim: true, default: "" },
    remarks: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
)

const DailyWorkLog = mongoose.model("DailyWorkLog", DailyWorkLogSchema)

export default DailyWorkLog
