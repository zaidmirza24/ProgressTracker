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
  todayHours: 0,
  loading: true,

  // Supports both a direct value and a functional updater, like useState's setter,
  // so useTaskStatusMutation's `setTasks(prev => prev.map(...))` calls work unchanged.
  setTasks: (updater) => set(state => ({
    tasks: typeof updater === "function" ? updater(state.tasks) : updater
  })),

  // Tasks list + today's tracked hours — the two things that actually need refreshing
  // after a timer action or a status transition. Kept separate from daily provisioning
  // so a Start/Pause/Stop click doesn't re-provision daily tasks on every call.
  loadTasks: async () => {
    try {
      const [tasksRes, hoursRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks`),
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
  }
}))

export default useEmployeeDashboardStore
