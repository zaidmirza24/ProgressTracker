import mongoose from "mongoose"

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["super_admin", "manager", "employee"],
      default: "employee"
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      default: null
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
)

const User = mongoose.model("User", UserSchema)

export default User
