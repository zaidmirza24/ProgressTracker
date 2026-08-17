import mongoose from "mongoose"

const CommentSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdAt: { type: Date, default: Date.now }
  }
)

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, default: "General", trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    estimatedHours: { type: Number, default: 0, min: 0, max: 100 },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Pending", "In Review", "Completed"],
      default: "Not Started"
    },
    progressPercentage: { type: Number, default: 0 },
    comments: [CommentSchema],
    isActive: { type: Boolean, default: true },
    // Blocked is ORTHOGONAL to status, deliberately — status answers "where is this in
    // the workflow?", blocked answers "can it proceed?". Conflating the two is what made
    // "Pending" mean both "timer paused" and "waiting on something", which in turn made
    // the pending-backlog-age signal measure evenings and weekends.
    //
    // Keeping it a flag also means the locked 5-state workflow (config/workflow.js),
    // the stepper, and isValidTransition need no changes at all.
    isBlocked: { type: Boolean, default: false },
    blockedReason: { type: String, trim: true, default: "" },
    blockedAt: { type: Date, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Daily task tracking
    isDaily: { type: Boolean, default: false },
    isCarryForward: { type: Boolean, default: false },
    templateRef: { type: mongoose.Schema.Types.ObjectId, ref: "TaskTemplate", default: null },
    dailyDate: { type: Date, default: null }, // The calendar day this daily task currently surfaces on (re-stamped to today on carry-forward)
    originalDailyDate: { type: Date, default: null }, // The calendar day this daily task was first generated for — set once, never overwritten
    // Audit history. An entry records EITHER a status transition (fromStatus/toStatus)
    // OR a set of field edits (changes) — never both. fromStatus/toStatus are therefore
    // optional rather than required; existing entries are unaffected.
    // `changes` stores display values (assignee names, formatted dates), not raw ObjectIds,
    // so the task detail timeline renders it without additional populates.
    history: [
      {
        fromStatus: { type: String },
        toStatus: { type: String },
        changes: [
          {
            field: { type: String, required: true },
            from: { type: String, default: "" },
            to: { type: String, default: "" }
          }
        ],
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        comment: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
)

// getTasks filters by { assignedTo, isActive } (employee) and { assignedBy/assignedTo, isActive }
// (manager); getProgressReport's overdue query filters by { isActive, dueDate, status }.
// These are the hottest read paths on this model and are worth indexing.
TaskSchema.index({ assignedTo: 1, isActive: 1 })
TaskSchema.index({ assignedBy: 1, isActive: 1 })
TaskSchema.index({ isActive: 1, status: 1, dueDate: 1 })
// "What's blocked right now" is a dashboard-level question asked on every load.
TaskSchema.index({ isBlocked: 1, isActive: 1 })

const Task = mongoose.model("Task", TaskSchema)

export default Task
