import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// Employee dashboard: the employee's own tasks + today's tracked hours.
// `loadTasks` mirrors the exact axios calls the original inline EmployeeDashboard
// made for its tasks-list refresh (timer settle, status transition, comment post).
// `provisionAndLoad` mirrors the original mount-time effect: idempotent daily-task
// provisioning (errors swallowed) THEN loadTasks — sequential, not parallel.
const useEmployeeDashboardStore = create((set, get) => ({
  tasks: [],
  // Locked Logic §7 — the primary view is daily. Server-side scoped so an employee's
  // morning screen shows today's work, not every task they've ever been assigned.
  scope: "today",
  todayHours: 0,
  loading: true,
  myReport: null,
  myReportError: false,

  // Supports both a direct value and a functional updater, like useState's setter,
  // so useTaskStatusMutation's `setTasks(prev => prev.map(...))` calls work unchanged.
  setTasks: (updater) => set(state => ({
    tasks: typeof updater === "function" ? updater(state.tasks) : updater
  })),

  // Tasks list + today's tracked hours — the two things that actually need refreshing
  // after a timer action or a status transition. Kept separate from daily provisioning
  // so a Start/Pause/Stop click doesn't re-provision daily tasks on every call.
  setScope: async (scope) => {
    set({ scope })
    await get().loadTasks()
  },

  loadTasks: async () => {
    try {
      const { scope } = get()
      const [tasksRes, hoursRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks?scope=${scope}`),
        axios.get(`${API_BASE}/api/work-sessions/today-hours`)
      ])
      set({ tasks: tasksRes.data.tasks, todayHours: hoursRes.data.hoursWorked })
    } catch (err) {
      console.error("Error loading employee tasks:", err)
    } finally {
      set({ loading: false })
    }
  },

  // One-time setup on mount: provision today's daily tasks, then load the list.
  provisionAndLoad: async () => {
    await axios.get(`${API_BASE}/api/tasks/daily`).catch(() => {}) // idempotent, non-blocking on failure
    await get().loadTasks()
  },

  // Personal progress signals (completion rate, estimation accuracy, pattern flag,
  // pending backlog) — scoped to just this employee server-side. Loaded separately,
  // non-blocking, so a slow report call never delays the task list/timer UI.
  loadMyReport: async () => {
    try {
      set({ myReportError: false })
      const res = await axios.get(`${API_BASE}/api/tasks/report`)
      const mine = res.data.employeeReport?.[0] ?? null
      set({ myReport: mine })
    } catch (err) {
      console.error("Error loading personal progress report:", err)
      set({ myReportError: true })
    }
  }
}))

export default useEmployeeDashboardStore
