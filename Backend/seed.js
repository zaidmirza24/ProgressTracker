import dotenv from "dotenv"
import mongoose from "mongoose"
import bcrypt from "bcryptjs"
import User from "./models/User.js"
import Department from "./models/Department.js"
import Team from "./models/Team.js"
import Task from "./models/Task.js"
import DailyWorkLog from "./models/DailyWorkLog.js"

dotenv.config()

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/progresstracker"

// ─── Helper ──────────────────────────────────────────────────────────────────
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const seed = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log("✅  Connected to MongoDB for seeding...")

    // ── 1. CLEAR ALL COLLECTIONS ─────────────────────────────────────────────
    await Promise.all([
      DailyWorkLog.deleteMany({}),
      Task.deleteMany({}),
      User.deleteMany({}),
      Team.deleteMany({}),
      Department.deleteMany({}),
    ])
    console.log("🗑️   Cleared all collections.")

    // ── 2. PASSWORD ──────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 10)

    // ── 3. SUPER ADMIN ───────────────────────────────────────────────────────
    await User.create({
      name: "Admin",
      email: "admin@tradex.com",
      passwordHash,
      role: "super_admin",
      isActive: true,
    })
    console.log("👑  Seeded Super Admin: admin@tradex.com")

    // ── 4. DEPARTMENTS ───────────────────────────────────────────────────────
    const [deptSales, deptLogistics, deptInventory, deptAccounts] =
      await Department.insertMany([
        {
          name: "Sales & Business Development",
          description:
            "Handles client acquisition, domain account sales, renewals, and upselling.",
        },
        {
          name: "Logistics & Dispatch",
          description:
            "Manages order fulfillment, shipping coordination, and last-mile delivery tracking.",
        },
        {
          name: "Inventory & Procurement",
          description:
            "Oversees stock levels, purchase orders, supplier negotiations, and warehousing.",
        },
        {
          name: "Accounts & Finance",
          description:
            "Handles billing, invoicing, payment reconciliation, and financial reporting.",
        },
      ])
    console.log("🏢  Seeded 4 Departments.")

    // ── 5. TEAMS ─────────────────────────────────────────────────────────────
    const [
      teamDomainAccounts,
      teamRetailSales,
      teamDispatch,
      teamReturns,
      teamProcurement,
      teamWarehouse,
      teamBilling,
    ] = await Team.insertMany([
      {
        name: "Domain Accounts",
        department: deptSales._id,
        description: "Manages corporate domain account clients and renewals.",
      },
      {
        name: "Retail Sales",
        department: deptSales._id,
        description: "Handles walk-in and online retail customer sales.",
      },
      {
        name: "Dispatch Operations",
        department: deptLogistics._id,
        description: "Coordinates daily shipment dispatch and courier handoffs.",
      },
      {
        name: "Returns & Refunds",
        department: deptLogistics._id,
        description: "Processes product returns, exchanges, and refund tickets.",
      },
      {
        name: "Procurement",
        department: deptInventory._id,
        description: "Raises purchase orders and manages supplier relationships.",
      },
      {
        name: "Warehouse",
        department: deptInventory._id,
        description: "Handles physical stock storage, audits, and bin management.",
      },
      {
        name: "Billing",
        department: deptAccounts._id,
        description: "Processes client invoices and payment reconciliation.",
      },
    ])
    console.log("👥  Seeded 7 Teams.")

    // ── 6. MANAGERS ──────────────────────────────────────────────────────────
    const [
      mgrSales,
      mgrLogistics,
      mgrInventory,
      mgrAccounts,
    ] = await User.insertMany([
      {
        name: "Arman (Sales Mgr)",
        email: "sales@tradex.com",
        passwordHash,
        role: "manager",
        department: deptSales._id,
        team: teamDomainAccounts._id,
        isActive: true,
      },
      {
        name: "Nadia (Logistics Mgr)",
        email: "logistics@tradex.com",
        passwordHash,
        role: "manager",
        department: deptLogistics._id,
        team: teamDispatch._id,
        isActive: true,
      },
      {
        name: "Bilal (Inventory Mgr)",
        email: "inventory@tradex.com",
        passwordHash,
        role: "manager",
        department: deptInventory._id,
        team: teamProcurement._id,
        isActive: true,
      },
      {
        name: "Sara (Accounts Mgr)",
        email: "accounts@tradex.com",
        passwordHash,
        role: "manager",
        department: deptAccounts._id,
        team: teamBilling._id,
        isActive: true,
      },
    ])
    console.log("🧑‍💼  Seeded 4 Managers.")

    // ── 7. EMPLOYEES ─────────────────────────────────────────────────────────
    const employees = await User.insertMany([
      // Sales – Domain Accounts (2)
      {
        name: "Omar",
        email: "emp1@tradex.com",
        passwordHash,
        role: "employee",
        department: deptSales._id,
        team: teamDomainAccounts._id,
        manager: mgrSales._id,
        isActive: true,
      },
      {
        name: "Hina",
        email: "emp2@tradex.com",
        passwordHash,
        role: "employee",
        department: deptSales._id,
        team: teamDomainAccounts._id,
        manager: mgrSales._id,
        isActive: true,
      },
      // Sales – Retail Sales (2)
      {
        name: "Kamran",
        email: "emp3@tradex.com",
        passwordHash,
        role: "employee",
        department: deptSales._id,
        team: teamRetailSales._id,
        manager: mgrSales._id,
        isActive: true,
      },
      {
        name: "Fatima",
        email: "emp4@tradex.com",
        passwordHash,
        role: "employee",
        department: deptSales._id,
        team: teamRetailSales._id,
        manager: mgrSales._id,
        isActive: true,
      },
      // Logistics – Dispatch (2)
      {
        name: "Usman",
        email: "emp5@tradex.com",
        passwordHash,
        role: "employee",
        department: deptLogistics._id,
        team: teamDispatch._id,
        manager: mgrLogistics._id,
        isActive: true,
      },
      {
        name: "Ayesha",
        email: "emp6@tradex.com",
        passwordHash,
        role: "employee",
        department: deptLogistics._id,
        team: teamDispatch._id,
        manager: mgrLogistics._id,
        isActive: true,
      },
      // Logistics – Returns (1)
      {
        name: "Raza",
        email: "emp7@tradex.com",
        passwordHash,
        role: "employee",
        department: deptLogistics._id,
        team: teamReturns._id,
        manager: mgrLogistics._id,
        isActive: true,
      },
      // Inventory – Procurement (2)
      {
        name: "Sana",
        email: "emp8@tradex.com",
        passwordHash,
        role: "employee",
        department: deptInventory._id,
        team: teamProcurement._id,
        manager: mgrInventory._id,
        isActive: true,
      },
      {
        name: "Hamza",
        email: "emp9@tradex.com",
        passwordHash,
        role: "employee",
        department: deptInventory._id,
        team: teamProcurement._id,
        manager: mgrInventory._id,
        isActive: true,
      },
      // Inventory – Warehouse (2)
      {
        name: "Zara",
        email: "emp10@tradex.com",
        passwordHash,
        role: "employee",
        department: deptInventory._id,
        team: teamWarehouse._id,
        manager: mgrInventory._id,
        isActive: true,
      },
      {
        name: "Ali",
        email: "emp11@tradex.com",
        passwordHash,
        role: "employee",
        department: deptInventory._id,
        team: teamWarehouse._id,
        manager: mgrInventory._id,
        isActive: true,
      },
      // Accounts – Billing (2)
      {
        name: "Maham",
        email: "emp12@tradex.com",
        passwordHash,
        role: "employee",
        department: deptAccounts._id,
        team: teamBilling._id,
        manager: mgrAccounts._id,
        isActive: true,
      },
      {
        name: "Tariq",
        email: "emp13@tradex.com",
        passwordHash,
        role: "employee",
        department: deptAccounts._id,
        team: teamBilling._id,
        manager: mgrAccounts._id,
        isActive: true,
      },
    ])

    const [
      empOmar, empHina, empKamran, empFatima,
      empUsman, empAyesha, empRaza,
      empSana, empHamza, empZara, empAli,
      empMaham, empTariq,
    ] = employees
    console.log("👷  Seeded 13 Employees.")

    // ── 8. TASKS ─────────────────────────────────────────────────────────────
    const tasks = await Task.insertMany([
      // --- Domain Accounts ---
      {
        title: "Renew TechCorp Domain Account Contract",
        description:
          "Follow up with TechCorp's procurement team to finalize the annual domain account renewal. Prepare updated pricing sheet and SLA terms.",
        category: "Domain Accounts",
        department: deptSales._id,
        assignedBy: mgrSales._id,
        assignedTo: empOmar._id,
        priority: "high",
        estimatedHours: 4,
        dueDate: daysAgo(-3),
        status: "In Progress",
        progressPercentage: 60,
      },
      {
        title: "Onboard NetSolutions as New Domain Client",
        description:
          "Complete KYC documentation, configure account portal access, and send welcome kit for NetSolutions.",
        category: "Domain Accounts",
        department: deptSales._id,
        assignedBy: mgrSales._id,
        assignedTo: empHina._id,
        priority: "high",
        estimatedHours: 6,
        dueDate: daysAgo(-1),
        status: "Waiting for Review",
        progressPercentage: 90,
      },
      {
        title: "Prepare Q3 Domain Account Usage Report",
        description:
          "Compile usage statistics, renewal rates, and churn analysis for all domain accounts for Q3 presentation.",
        category: "Domain Accounts",
        department: deptSales._id,
        assignedBy: mgrSales._id,
        assignedTo: empOmar._id,
        priority: "medium",
        estimatedHours: 3,
        dueDate: daysAgo(5),
        status: "Approved",
        progressPercentage: 100,
      },
      // --- Retail Sales ---
      {
        title: "Update In-Office Product Catalog for October",
        description:
          "Refresh the in-office product display and update the digital catalog with new SKUs for the upcoming month.",
        category: "Retail Sales",
        department: deptSales._id,
        assignedBy: mgrSales._id,
        assignedTo: empKamran._id,
        priority: "medium",
        estimatedHours: 5,
        dueDate: daysAgo(-5),
        status: "In Progress",
        progressPercentage: 40,
      },
      {
        title: "Handle Walk-In Client Inquiry – Bulk Office Supplies",
        description:
          "Assist the walk-in client from Central Enterprises with bulk office supplies quote. Coordinate with procurement if stock is low.",
        category: "Retail Sales",
        department: deptSales._id,
        assignedBy: mgrSales._id,
        assignedTo: empFatima._id,
        priority: "high",
        estimatedHours: 2,
        dueDate: daysAgo(1),
        status: "Completed",
        progressPercentage: 100,
      },
      // --- Dispatch Operations ---
      {
        title: "Coordinate Monday Morning Dispatch Run",
        description:
          "Prepare dispatch manifest for 48 orders scheduled for Monday. Confirm courier pickup times with TCS and Leopards.",
        category: "Logistics",
        department: deptLogistics._id,
        assignedBy: mgrLogistics._id,
        assignedTo: empUsman._id,
        priority: "high",
        estimatedHours: 3,
        dueDate: daysAgo(0),
        status: "In Progress",
        progressPercentage: 70,
      },
      {
        title: "Resolve Delayed Shipment – Order #4872",
        description:
          "Investigate delay for Order #4872 (Client: SafeTech Ltd). Coordinate with courier and update client ETA.",
        category: "Logistics",
        department: deptLogistics._id,
        assignedBy: mgrLogistics._id,
        assignedTo: empAyesha._id,
        priority: "high",
        estimatedHours: 2,
        dueDate: daysAgo(2),
        status: "Approved",
        progressPercentage: 100,
      },
      {
        title: "Generate Weekly Dispatch Summary Report",
        description:
          "Compile on-time delivery rate, failed deliveries, and average dispatch time for the past week.",
        category: "Reporting",
        department: deptLogistics._id,
        assignedBy: mgrLogistics._id,
        assignedTo: empAyesha._id,
        priority: "low",
        estimatedHours: 2,
        dueDate: daysAgo(-2),
        status: "Not Started",
        progressPercentage: 0,
      },
      // --- Returns & Refunds ---
      {
        title: "Process Return for Order #4561 – Damaged Goods",
        description:
          "Inspect returned items from Order #4561, validate damage claim, and initiate refund through accounts.",
        category: "Returns",
        department: deptLogistics._id,
        assignedBy: mgrLogistics._id,
        assignedTo: empRaza._id,
        priority: "high",
        estimatedHours: 3,
        dueDate: daysAgo(1),
        status: "Waiting for Review",
        progressPercentage: 85,
      },
      // --- Procurement ---
      {
        title: "Raise PO for Office Stationery Restock",
        description:
          "Create purchase order for 500 units of stationery packs. Get approval from Finance before sending to supplier.",
        category: "Procurement",
        department: deptInventory._id,
        assignedBy: mgrInventory._id,
        assignedTo: empSana._id,
        priority: "medium",
        estimatedHours: 2,
        dueDate: daysAgo(-1),
        status: "Accepted",
        progressPercentage: 20,
      },
      {
        title: "Negotiate Pricing with New Packaging Supplier",
        description:
          "Evaluate quotes from 3 packaging suppliers. Prepare comparison sheet and recommend the best option to management.",
        category: "Procurement",
        department: deptInventory._id,
        assignedBy: mgrInventory._id,
        assignedTo: empHamza._id,
        priority: "high",
        estimatedHours: 8,
        dueDate: daysAgo(-7),
        status: "In Progress",
        progressPercentage: 50,
      },
      {
        title: "Close Monthly Supplier Reconciliation",
        description:
          "Match all purchase orders against supplier invoices for the month and flag any discrepancies.",
        category: "Procurement",
        department: deptInventory._id,
        assignedBy: mgrInventory._id,
        assignedTo: empSana._id,
        priority: "medium",
        estimatedHours: 4,
        dueDate: daysAgo(3),
        status: "Approved",
        progressPercentage: 100,
      },
      // --- Warehouse ---
      {
        title: "Conduct Bi-Weekly Stock Audit – Aisle C & D",
        description:
          "Physical count of all items in Aisle C and D. Update inventory system and report any discrepancies.",
        category: "Warehouse",
        department: deptInventory._id,
        assignedBy: mgrInventory._id,
        assignedTo: empZara._id,
        priority: "medium",
        estimatedHours: 6,
        dueDate: daysAgo(0),
        status: "In Progress",
        progressPercentage: 55,
      },
      {
        title: "Set Up New Bin Locations for Electronics Stock",
        description:
          "Allocate and label new bin positions for incoming electronics batch. Update WMS accordingly.",
        category: "Warehouse",
        department: deptInventory._id,
        assignedBy: mgrInventory._id,
        assignedTo: empAli._id,
        priority: "low",
        estimatedHours: 4,
        dueDate: daysAgo(-4),
        status: "Not Started",
        progressPercentage: 0,
      },
      // --- Billing / Accounts ---
      {
        title: "Send October Invoices to All Domain Account Clients",
        description:
          "Generate and dispatch monthly invoices to all active domain account clients. Confirm delivery receipts.",
        category: "Billing",
        department: deptAccounts._id,
        assignedBy: mgrAccounts._id,
        assignedTo: empMaham._id,
        priority: "high",
        estimatedHours: 5,
        dueDate: daysAgo(-2),
        status: "In Progress",
        progressPercentage: 65,
      },
      {
        title: "Reconcile Outstanding Payments – Q3",
        description:
          "Identify overdue invoices from Q3, send payment reminders, and escalate accounts over 60 days.",
        category: "Billing",
        department: deptAccounts._id,
        assignedBy: mgrAccounts._id,
        assignedTo: empTariq._id,
        priority: "high",
        estimatedHours: 6,
        dueDate: daysAgo(4),
        status: "Approved",
        progressPercentage: 100,
      },
      {
        title: "Prepare Monthly P&L Summary for Management",
        description:
          "Compile profit & loss figures for October and present to management with variance analysis vs. budget.",
        category: "Finance",
        department: deptAccounts._id,
        assignedBy: mgrAccounts._id,
        assignedTo: empMaham._id,
        priority: "medium",
        estimatedHours: 5,
        dueDate: daysAgo(-6),
        status: "Not Started",
        progressPercentage: 0,
      },
    ])
    console.log(`📋  Seeded ${tasks.length} Tasks.`)

    // ── 9. DAILY WORK LOGS ───────────────────────────────────────────────────
    await DailyWorkLog.insertMany([
      // Omar – Domain Accounts
      {
        employee: empOmar._id,
        date: daysAgo(1),
        todaysWork:
          "Called TechCorp procurement team, shared renewal quote, awaiting sign-off.",
        hoursWorked: 7,
        tasksCompleted: "Sent renewal contract draft to TechCorp",
        problemsFaced: "Client requested additional discount – escalated to manager",
        nextPlan: "Follow up with TechCorp and finalize terms",
      },
      // Hina – Domain Accounts onboarding
      {
        employee: empHina._id,
        date: daysAgo(1),
        todaysWork:
          "Completed KYC for NetSolutions, configured portal access, sent welcome email.",
        hoursWorked: 8,
        tasksCompleted: "NetSolutions onboarding 90% complete",
        problemsFaced: "Portal config took longer due to 2FA setup issue",
        nextPlan: "Submit for manager review and await client confirmation",
      },
      // Kamran – Retail
      {
        employee: empKamran._id,
        date: daysAgo(1),
        todaysWork:
          "Updated 40% of catalog entries for new SKUs. Photographed display stand.",
        hoursWorked: 6,
        tasksCompleted: "",
        problemsFaced: "Missing product images for 5 new items – waiting on supplier",
        nextPlan: "Complete remaining SKU entries and update pricing",
      },
      // Usman – Dispatch
      {
        employee: empUsman._id,
        date: daysAgo(1),
        todaysWork:
          "Prepared dispatch manifest for 48 orders. Confirmed TCS pickup at 9 AM.",
        hoursWorked: 8,
        tasksCompleted: "Dispatch manifest submitted",
        problemsFaced: "Leopards courier delayed by 2 hours – rerouted 6 orders to TCS",
        nextPlan: "Confirm successful delivery for all dispatched orders",
      },
      // Ayesha – Resolved delayed shipment
      {
        employee: empAyesha._id,
        date: daysAgo(2),
        todaysWork:
          "Tracked Order #4872, contacted courier, updated client with revised ETA.",
        hoursWorked: 7,
        tasksCompleted: "Order #4872 delay resolved and client notified",
        problemsFaced: "Initial courier response was delayed by 3 hours",
        nextPlan: "Generate weekly dispatch summary report",
      },
      // Sana – Procurement
      {
        employee: empSana._id,
        date: daysAgo(1),
        todaysWork: "Drafted PO for stationery restock, submitted to Finance for approval.",
        hoursWorked: 5,
        tasksCompleted: "Stationery PO submitted",
        problemsFaced: "Finance needed updated vendor bank details before approval",
        nextPlan: "Follow up on PO approval and send to supplier",
      },
      // Hamza – Supplier negotiation
      {
        employee: empHamza._id,
        date: daysAgo(1),
        todaysWork:
          "Received quotes from 2 out of 3 packaging suppliers. Started comparison matrix.",
        hoursWorked: 7,
        tasksCompleted: "",
        problemsFaced: "Third supplier has not responded to RFQ – sent reminder",
        nextPlan: "Receive final quote and complete recommendation report",
      },
      // Zara – Warehouse audit
      {
        employee: empZara._id,
        date: daysAgo(0),
        todaysWork: "Completed stock count for Aisle C. Found 2 discrepancies, logged them.",
        hoursWorked: 6,
        tasksCompleted: "Aisle C audit complete",
        problemsFaced: "System showed 3 extra units of Item #SW-904 – flagged for investigation",
        nextPlan: "Complete Aisle D audit and update inventory system",
      },
      // Maham – Billing
      {
        employee: empMaham._id,
        date: daysAgo(1),
        todaysWork:
          "Generated invoices for 18 of 28 domain account clients. Sent via email with read receipts.",
        hoursWorked: 8,
        tasksCompleted: "",
        problemsFaced: "3 client emails bounced – need updated contacts from sales team",
        nextPlan: "Complete remaining invoices and confirm email delivery",
      },
    ])
    console.log("📝  Seeded 9 Daily Work Logs.")

    console.log("\n🎉  Database seeded successfully! — TradeX Demo")
    console.log("    • Departments : 4")
    console.log("    • Teams       : 7")
    console.log("    • Super Admin : admin@tradex.com        / password123")
    console.log("    • Manager – Sales      : sales@tradex.com      / password123")
    console.log("    • Manager – Logistics  : logistics@tradex.com  / password123")
    console.log("    • Manager – Inventory  : inventory@tradex.com  / password123")
    console.log("    • Manager – Accounts   : accounts@tradex.com   / password123")
    console.log("    • Employees   : emp1@tradex.com … emp13@tradex.com / password123")
    console.log("    • Tasks       : 17")
    console.log("    • Work Logs   : 9")

    process.exit(0)
  } catch (error) {
    console.error("❌  Error seeding database:", error)
    process.exit(1)
  }
}

seed()
