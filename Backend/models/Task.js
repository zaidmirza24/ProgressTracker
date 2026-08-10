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
      enum: [
        "Not Started",
        "Accepted",
        "In Progress",
        "Waiting for Review",
        "Completed",
        "Approved",
        "Rejected",
        "Reopened"
      ],
      default: "Not Started"
    },
    progressPercentage: { type: Number, default: 0 },
    comments: [CommentSchema],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

const Task = mongoose.model("Task", TaskSchema)

export default Task
