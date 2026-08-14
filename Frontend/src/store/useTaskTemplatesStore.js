import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// SuperAdmin: task templates CRUD. Independent domain — fetches its own copy of
// departments (for the scope dropdown) rather than reading useOrgStore, matching
// the original TaskTemplatesTab's own independent Promise.all fetch.
const useTaskTemplatesStore = create((set, get) => ({
  templates: [],
  departments: [],
  loading: true,

  fetchTemplates: async () => {
    try {
      const [tplRes, deptRes] = await Promise.all([
        axios.get(`${API_BASE}/api/task-templates`),
        axios.get(`${API_BASE}/api/departments`)
      ])
      set({ templates: tplRes.data.templates, departments: deptRes.data.departments })
    } catch (err) {
      console.error("Error loading task templates:", err)
    } finally {
      set({ loading: false })
    }
  },

  createTemplate: async (form) => {
    await axios.post(`${API_BASE}/api/task-templates`, form)
    await get().fetchTemplates()
  },

  updateTemplate: async (id, form) => {
    await axios.put(`${API_BASE}/api/task-templates/${id}`, form)
    await get().fetchTemplates()
  },

  deleteTemplate: async (id) => {
    await axios.delete(`${API_BASE}/api/task-templates/${id}`)
    await get().fetchTemplates()
  }
}))

export default useTaskTemplatesStore
