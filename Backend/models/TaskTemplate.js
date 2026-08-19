import mongoose from "mongoose"

const TaskTemplateSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    category: { type: String, default: "Daily", trim: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    estimatedHours: { type: Number, default: 1 },
    // "global" = all employees, "department" = employees in a specific dept only,
    // "employees" = a hand-picked list of individual employees
    scope: { type: String, enum: ["global", "department", "employees"], default: "global" },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
)

const TaskTemplate = mongoose.model("TaskTemplate", TaskTemplateSchema)

export default TaskTemplate
