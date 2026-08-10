import dotenv from "dotenv"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import User from "./models/User.js"

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("Connected to MongoDB for seeding...")

    // Clear existing users
    await User.deleteMany({})
    console.log("Cleared existing users.")

    const passwordHash = await bcrypt.hash("password123", 10)

    // Seed Super Admin
    await User.create({
      name: "Super Admin",
      email: "admin@company.com",
      passwordHash,
      role: "super_admin",
      isActive: true
    })
    console.log("Seeded Super Admin: admin@company.com")

    // Seed Manager
    const manager = await User.create({
      name: "Office Manager",
      email: "manager@company.com",
      passwordHash,
      role: "manager",
      isActive: true
    })
    console.log("Seeded Manager: manager@company.com")

    // Seed 8 Employees
    const employeesData = Array.from({ length: 8 }).map((_, i) => ({
      name: `Employee ${i + 1}`,
      email: `employee${i + 1}@company.com`,
      passwordHash,
      role: "employee",
      manager: manager._id,
      isActive: true
    }))

    await User.insertMany(employeesData)
    console.log("Seeded 8 Employees (linked to manager@company.com)")

    console.log("Database seeded successfully!")
    process.exit(0)
  } catch (error) {
    console.error("Error seeding database:", error)
    process.exit(1)
  }
}

seed()
