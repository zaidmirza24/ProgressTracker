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

// Enforces "exactly one active timer per employee" (locked timer rule) at the database
// level, not just in application logic: a partial unique index means Mongo itself
// rejects a second { employee, stoppedAt: null } document, closing the race where two
// concurrent start-timer requests could both pass the "is anything active?" check
// before either write commits.
WorkSessionSchema.index(
  { employee: 1 },
  { unique: true, partialFilterExpression: { stoppedAt: null } }
)

const WorkSession = mongoose.model("WorkSession", WorkSessionSchema)

export default WorkSession
