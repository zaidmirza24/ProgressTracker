import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// Work calendar: working days, holidays, and absences.
//
// `calendar` is the read model every capacity calculation consumes — pass it to
// getEmployeeCapacity/getCapacityForecast so the frontend applies exactly the rules
// the server does. It stays null until loaded, and every helper treats null as
// "every day is a working day", which is the pre-calendar behaviour — so a slow or
// failed calendar fetch degrades to the old numbers rather than breaking the page.
const useCalendarStore = create((set, get) => ({
  calendar: null,          // { workingDays, holidays, timezone, absences }
  absences: [],            // full list w/ populated employee, for management screens
  loading: false,
  error: false,
  saving: false,

  // Lightweight context used by every capacity surface. Safe to call on each dashboard
  // mount — it's a single small document plus the in-scope absences.
  fetchContext: async () => {
    try {
      set({ loading: true, error: false })
      const res = await axios.get(`${API_BASE}/api/calendar/context`)
      set({ calendar: res.data })
    } catch (err) {
      console.error("Error loading work calendar:", err)
      set({ error: true })
    } finally {
      set({ loading: false })
    }
  },

  // Admin: working days + holidays
  updateSettings: async (payload) => {
    set({ saving: true })
    try {
      await axios.put(`${API_BASE}/api/calendar/settings`, payload)
      await get().fetchContext()
      return { success: true }
    } catch (err) {
      console.error("Error saving work calendar:", err)
      return { success: false }
    } finally {
      set({ saving: false })
    }
  },

  // Management list (populated employee names) — separate from the context's raw
  // absences, which exist only to feed capacity maths.
  fetchAbsences: async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/calendar/absences`)
      set({ absences: res.data.absences })
    } catch (err) {
      console.error("Error loading absences:", err)
    }
  },

  createAbsence: async (payload) => {
    set({ saving: true })
    try {
      await axios.post(`${API_BASE}/api/calendar/absences`, payload)
      // Refresh both: the context drives capacity, the list drives the management UI.
      await Promise.all([get().fetchContext(), get().fetchAbsences()])
      return { success: true }
    } catch (err) {
      console.error("Error recording absence:", err)
      return { success: false, code: err.response?.data?.code }
    } finally {
      set({ saving: false })
    }
  },

  deleteAbsence: async (id) => {
    set({ saving: true })
    try {
      await axios.delete(`${API_BASE}/api/calendar/absences/${id}`)
      await Promise.all([get().fetchContext(), get().fetchAbsences()])
      return { success: true }
    } catch (err) {
      console.error("Error removing absence:", err)
      return { success: false }
    } finally {
      set({ saving: false })
    }
  }
}))

export default useCalendarStore
