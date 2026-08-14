import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// Manager dashboard: tasks, subordinate employees, departments, and team work logs.
// `loadData` mirrors the exact axios calls the original inline ManagerDashboard made.
// `managerId` is passed in by the caller (component reads it from useAuth()) since
// the store itself has no access to the logged-in user.
const useManagerDashboardStore = create((set) => ({
  tasks: [],
  employees: [],
  departments: [],
  workLogs: [],
  report: null,
  loading: true,

  // Supports both a direct value and a functional updater, like useState's setter,
  // so useTaskStatusMutation's `setTasks(prev => prev.map(...))` calls work unchanged.
  setTasks: (updater) => set(state => ({
    tasks: typeof updater === "function" ? updater(state.tasks) : updater
  })),

  // `role` distinguishes a manager (scoped to their own direct reports) from a
  // super_admin (org-wide) — both share this store so Manager and Admin dashboards
  // reuse the exact same components. `/api/tasks/report` already scopes itself
  // server-side the same way, so only the `employees` filter needs branching here.
  loadData: async (userId, role = "manager") => {
    try {
      const [tRes, uRes, dRes, reportRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks`),
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/departments`),
        // Iterations 7-10's signals (overrun, capacity, completion split, pattern
        // detection) — server already scopes this to the manager's own subordinates.
        axios.get(`${API_BASE}/api/tasks/report`)
      ])
      // Managers see only their own direct reports; super_admin sees everyone org-wide
      const subordinates = role === "manager"
        ? uRes.data.users.filter(u => u.manager?._id === userId)
        : uRes.data.users
      // Load today's work logs
      const logsRes = await axios.get(`${API_BASE}/api/daily-work-logs`)
      set({
        tasks: tRes.data.tasks,
        employees: subordinates,
        departments: dRes.data.departments,
        workLogs: logsRes.data.logs,
        report: reportRes.data
      })
    } catch (err) {
      console.error("Error loading dashboard data:", err)
    } finally {
      set({ loading: false })
    }
  }
}))

export default useManagerDashboardStore
