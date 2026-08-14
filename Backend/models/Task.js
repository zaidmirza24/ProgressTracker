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
    estimatedHours: { type: Number, default: 0 },
    dueDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Not Started", "In Progress", "Pending", "In Review", "Completed"],
      default: "Not Started"
    },
    progressPercentage: { type: Number, default: 0 },
    comments: [CommentSchema],
    isActive: { type: Boolean, default: true },
    // Daily task tracking
    isDaily: { type: Boolean, default: false },
    isCarryForward: { type: Boolean, default: false },
    templateRef: { type: mongoose.Schema.Types.ObjectId, ref: "TaskTemplate", default: null },
    dailyDate: { type: Date, default: null }, // The calendar day this daily task was generated for
    // Transition Audit History
    history: [
      {
        fromStatus: { type: String, required: true },
        toStatus: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        comment: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
)

const Task = mongoose.model("Task", TaskSchema)

export default Task
