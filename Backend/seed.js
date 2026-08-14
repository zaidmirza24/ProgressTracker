import dotenv from "dotenv"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import User from "./models/User.js"
import Department from "./models/Department.js"
import Team from "./models/Team.js"
import Task from "./models/Task.js"
import DailyWorkLog from "./models/DailyWorkLog.js"
import TaskTemplate from "./models/TaskTemplate.js"
import WorkSession from "./models/WorkSession.js"

dotenv.config()

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("✅ Connected to MongoDB for seeding...")

    // ── 1. CLEAR ALL COLLECTIONS ─────────────────────────────────────────────
    await Promise.all([
      DailyWorkLog.deleteMany({}),
      Task.deleteMany({}),
      User.deleteMany({}),
      Team.deleteMany({}),
      Department.deleteMany({}),
      TaskTemplate.deleteMany({}),
      WorkSession.deleteMany({})
    ])
    console.log("🗑️  Cleared all collections.")

    // ── 2. PASSWORD ──────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10)

    // ── 3. SEED DEPARTMENTS ──────────────────────────────────────────────────
    const deptEngineering = await Department.create({ name: "Engineering", description: "Product building and infrastructure" })
    const deptProduct = await Department.create({ name: "Product", description: "Product design and roadmapping" })
    const deptSales = await Department.create({ name: "Sales", description: "Customer acquisition and accounts" })
    console.log("🏢 Seeded Departments")

    // ── 4. SEED TEAMS ────────────────────────────────────────────────────────
    const teamFrontend = await Team.create({ name: "Frontend Core", department: deptEngineering._id, description: "Vite, React, Tailwind UI design" })
    const teamBackend = await Team.create({ name: "Backend API", department: deptEngineering._id, description: "Node.js, Express, MongoDB server developers" })
    const teamDesign = await Team.create({ name: "UX Design", department: deptProduct._id, description: "User flows and wireframes" })
    const teamInsideSales = await Team.create({ name: "Inside Sales", department: deptSales._id, description: "Lead generation and outreach" })
    console.log("👥 Seeded Teams")

    // ── 5. SEED USERS ────────────────────────────────────────────────────────
    // Super Admin
    const superAdmin = await User.create({
      name: "Super Admin",
      email: "admin@tradex.com",
      passwordHash,
      role: "super_admin",
      isActive: true
    })

    // Managers
    const managerJohn = await User.create({
      name: "John Miller",
      email: "logistics@tradex.com",
      passwordHash,
      role: "manager",
      department: deptEngineering._id,
      team: teamBackend._id,
      isActive: true
    })

    const managerPriya = await User.create({
      name: "Priya Sharma",
      email: "sales@tradex.com",
      passwordHash,
      role: "manager",
      department: deptProduct._id,
      team: teamDesign._id,
      isActive: true
    })

    // Employees
    const employeeSarah = await User.create({
      name: "Sarah Chen",
      email: "emp1@tradex.com",
      passwordHash,
      role: "employee",
      department: deptEngineering._id,
      team: teamFrontend._id,
      manager: managerJohn._id,
      isActive: true
    })

    const employeeAlex = await User.create({
      name: "Alex Kim",
      email: "emp2@tradex.com",
      passwordHash,
      role: "employee",
      department: deptEngineering._id,
      team: teamBackend._id,
      manager: managerJohn._id,
      isActive: true
    })

    const employeeMaya = await User.create({
      name: "Maya Patel",
      email: "emp3@tradex.com",
      passwordHash,
      role: "employee",
      department: deptProduct._id,
      team: teamDesign._id,
      manager: managerPriya._id,
      isActive: true
    })

    console.log("👤 Seeded Users (admin@company.com, john@company.com, priya@company.com, sarah@company.com, alex@company.com, maya@company.com)")

    // ── 6. SEED TASK TEMPLATES (Daily) ───────────────────────────────────────
    const templateDailyStandup = await TaskTemplate.create({
      title: "Morning Standup Sync",
      description: "Discuss daily objectives, blockers, and update current tasks board.",
      category: "Daily",
      priority: "low",
      estimatedHours: 0.25,
      scope: "global",
      createdBy: superAdmin._id
    })

    const templateDailyLogs = await TaskTemplate.create({
      title: "Email & Slack Triage",
      description: "Review outstanding alerts, client comments, and channel updates.",
      category: "Daily",
      priority: "medium",
      estimatedHours: 0.5,
      scope: "global",
      createdBy: superAdmin._id
    })
    console.log("🔄 Seeded Task Templates")

    // ── 7. SEED TASKS ────────────────────────────────────────────────────────
    // Sarah's tasks
    await Task.create({
      title: "API Endpoint Integration",
      description: "Connect the frontend workspace forms with the express backend controllers.",
      category: "Development",
      department: deptEngineering._id,
      assignedBy: managerJohn._id,
      assignedTo: employeeSarah._id,
      priority: "medium",
      estimatedHours: 4,
      status: "In Progress",
      progressPercentage: 50,
      history: [
        { fromStatus: "Not Started", toStatus: "In Progress", changedBy: employeeSarah._id, comment: "Starting development" }
      ]
    })

    await Task.create({
      title: "Fix Production Crash",
      description: "Resolve the infinite redirect loop on expired token API calls.",
      category: "Bug Fix",
      department: deptEngineering._id,
      assignedBy: managerJohn._id,
      assignedTo: employeeSarah._id,
      priority: "high",
      estimatedHours: 2,
      status: "Not Started",
      progressPercentage: 0,
      dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Overdue (yesterday)
    })

    await Task.create({
      title: "Respond to Client Feedback",
      description: "Incorporate client review changes from the engineering audit report.",
      category: "Documentation",
      department: deptEngineering._id,
      assignedBy: managerJohn._id,
      assignedTo: employeeSarah._id,
      priority: "high",
      estimatedHours: 3,
      status: "Not Started",
      progressPercentage: 0,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // Overdue (2 days ago)
    })

    // Alex's tasks
    await Task.create({
      title: "OAuth Flow Fix",
      description: "State parameter mismatch verification on redirect handlers.",
      category: "Bug Fix",
      department: deptEngineering._id,
      assignedBy: managerJohn._id,
      assignedTo: employeeAlex._id,
      priority: "high",
      estimatedHours: 3,
      status: "In Review",
      progressPercentage: 90,
      comments: [
        { text: "Resolved the state parameter mismatch on redirects.", author: employeeAlex._id }
      ],
      history: [
        { fromStatus: "Not Started", toStatus: "In Progress", changedBy: employeeAlex._id },
        { fromStatus: "In Progress", toStatus: "In Review", changedBy: employeeAlex._id, comment: "Submitting for review" }
      ]
    })

    // Maya's tasks
    await Task.create({
      title: "Update API Documentation",
      description: "Swagger docs update for version 2 endpoints.",
      category: "Documentation",
      department: deptProduct._id,
      assignedBy: managerPriya._id,
      assignedTo: employeeMaya._id,
      priority: "low",
      estimatedHours: 2,
      status: "In Review",
      progressPercentage: 90,
      comments: [
        { text: "Swagger docs updated for v2 endpoints.", author: employeeMaya._id }
      ],
      history: [
        { fromStatus: "Not Started", toStatus: "In Progress", changedBy: employeeMaya._id },
        { fromStatus: "In Progress", toStatus: "In Review", changedBy: employeeMaya._id, comment: "Please review Swagger updates." }
      ]
    })

    console.log("📋 Seeded Tasks (including overdue and awaiting review items)")

    console.log("\n🎉 Database cleared and test data successfully initialized!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding database:", error)
    process.exit(1)
  }
}

seed()
