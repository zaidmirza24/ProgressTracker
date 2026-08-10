import mongoose from "mongoose"

const TeamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

const Team = mongoose.model("Team", TeamSchema)
export default Team
