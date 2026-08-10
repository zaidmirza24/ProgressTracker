import mongoose from "mongoose"

const DepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

const Department = mongoose.model("Department", DepartmentSchema)
export default Department
