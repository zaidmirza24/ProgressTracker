import { create } from "zustand"
import axios from "axios"
import API_BASE from "../lib/api"

// SuperAdmin: departments + teams + users in one store since Teams' department
// dropdown and the Users onboarding wizard both cross-reference this data.
// Each `fetchX` mirrors the exact axios calls the original inline tab components made.
const useOrgStore = create((set, get) => ({
  departments: [],
  teams: [],
  users: [],
  deptLoading: true,
  teamsLoading: true,
  usersLoading: true,

  fetchDepartments: async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/departments`)
      set({ departments: res.data.departments })
    } catch (err) {
      console.error("Error loading departments:", err)
    } finally {
      set({ deptLoading: false })
    }
  },

  createDepartment: async (form) => {
    await axios.post(`${API_BASE}/api/departments`, form)
    await get().fetchDepartments()
  },

  updateDepartment: async (id, form) => {
    await axios.put(`${API_BASE}/api/departments/${id}`, form)
    await get().fetchDepartments()
  },

  fetchTeams: async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        axios.get(`${API_BASE}/api/teams`),
        axios.get(`${API_BASE}/api/departments`)
      ])
      set({ teams: tRes.data.teams, departments: dRes.data.departments })
    } catch (err) {
      console.error("Error loading teams:", err)
    } finally {
      set({ teamsLoading: false })
    }
  },

  createTeam: async (form) => {
    await axios.post(`${API_BASE}/api/teams`, form)
    await get().fetchTeams()
  },

  updateTeam: async (id, form) => {
    const res = await axios.put(`${API_BASE}/api/teams/${id}`, form)
    await get().fetchTeams()
    // A department change cascades to the team's members server-side (their `department`
    // field is kept in sync) — refetch users too, or the Users tab shows stale department
    // badges until an unrelated action happens to reload it.
    if (res.data.membersUpdated) {
      await get().fetchUsers()
    }
  },

  fetchUsers: async () => {
    try {
      const [uRes, dRes, tRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/departments`),
        axios.get(`${API_BASE}/api/teams`)
      ])
      set({ users: uRes.data.users, departments: dRes.data.departments, teams: tRes.data.teams })
    } catch (err) {
      console.error("Error loading users:", err)
    } finally {
      set({ usersLoading: false })
    }
  },

  createUser: async (payload) => {
    const res = await axios.post(`${API_BASE}/api/users`, payload)
    await get().fetchUsers()
    return res.data.user
  },

  // Soft-delete (Core Rule 2). `reassignTo` is required when the person still has open
  // assigned tasks — the server refuses otherwise rather than stranding the work.
  deactivateUser: async (id, reassignTo = null) => {
    try {
      const res = await axios.patch(`${API_BASE}/api/users/${id}/deactivate`, { reassignTo })
      await get().fetchUsers()
      return { success: true, ...res.data }
    } catch (err) {
      console.error("Error deactivating user:", err)
      return { success: false, code: err.response?.data?.code }
    }
  },

  updateUser: async (id, payload) => {
    await axios.put(`${API_BASE}/api/users/${id}`, payload)
    await get().fetchUsers()
  },

  // Inline department/team creation used by the onboarding wizard (Users tab, step 2).
  createDepartmentInline: async (name) => {
    const res = await axios.post(`${API_BASE}/api/departments`, { name, description: "Created during user onboarding" })
    const dRes = await axios.get(`${API_BASE}/api/departments`)
    set({ departments: dRes.data.departments })
    return res.data.department?._id || res.data.department || ""
  },

  createTeamInline: async (name, department) => {
    const res = await axios.post(`${API_BASE}/api/teams`, { name, department })
    const tRes = await axios.get(`${API_BASE}/api/teams`)
    set({ teams: tRes.data.teams })
    return res.data.team?._id || res.data.team || ""
  }
}))

export default useOrgStore
