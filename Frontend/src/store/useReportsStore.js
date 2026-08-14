import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// SuperAdmin: Reports tab — 5 sub-tabs fed by one GET /api/tasks/report call,
// plus the active sub-tab and employee drilldown modal selection.
const useReportsStore = create((set, get) => ({
  reports: null,
  loading: true,
  activeSubTab: "employees",
  timeframe: "today",
  startDate: "",
  endDate: "",
  selectedEmployee: null,

  setActiveSubTab: (tab) => set({ activeSubTab: tab }),
  setSelectedEmployee: (employee) => set({ selectedEmployee: employee }),

  setTimeframe: (val) => {
    if (val !== "custom") {
      set({ timeframe: val, startDate: "", endDate: "" })
    } else {
      set({ timeframe: val })
    }
  },
  setStartDate: (val) => set({ startDate: val }),
  setEndDate: (val) => set({ endDate: val }),

  fetchReports: async () => {
    const { timeframe, startDate, endDate } = get()
    try {
      set({ loading: true })
      let url = `${API_BASE}/api/tasks/report`
      const params = []

      let finalStart = startDate
      let finalEnd = endDate

      if (timeframe !== "all" && timeframe !== "custom") {
        const now = new Date()
        const start = new Date()
        if (timeframe === "today") {
          start.setHours(0, 0, 0, 0)
        } else if (timeframe === "week") {
          start.setDate(now.getDate() - 7)
        } else if (timeframe === "month") {
          start.setMonth(now.getMonth() - 1)
        }
        finalStart = start.toISOString().split("T")[0]
        finalEnd = now.toISOString().split("T")[0]
      }

      if (finalStart && finalEnd) {
        params.push(`startDate=${finalStart}`)
        params.push(`endDate=${finalEnd}`)
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`
      }

      const res = await axios.get(url)
      set({ reports: res.data })
    } catch (err) {
      console.error("Error loading progress reports:", err)
    } finally {
      set({ loading: false })
    }
  }
}))

export default useReportsStore
