import mongoose from "mongoose"

const TimerEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["pause", "resume"], required: true },
    timestamp: { type: Date, default: Date.now }
  }
)

const WorkSessionSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, default: Date.now },
    events: [TimerEventSchema],
    stoppedAt: { type: Date, default: null },
    totalSeconds: { type: Number, default: 0 } // Accumulated offline/paused seconds
  },
  { timestamps: true }
)

// Every timer action (start/pause/resume/stop) and the active-session check on
// dashboard load queries by { employee, stoppedAt: null } — the hottest read path
// on this model. Task-time rollups (attachTrackedSecondsToTasks, progress report)
// query by { task, stoppedAt } in bulk. Both are worth a compound index.
WorkSessionSchema.index({ employee: 1, stoppedAt: 1 })
WorkSessionSchema.index({ task: 1, stoppedAt: 1 })

const WorkSession = mongoose.model("WorkSession", WorkSessionSchema)

export default WorkSession
