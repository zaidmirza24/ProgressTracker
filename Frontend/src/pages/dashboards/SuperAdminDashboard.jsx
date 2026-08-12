import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, UserPlus, Pencil, AlertTriangle, User, Mail, Shield, Plus, AlertCircle, BarChart3, Repeat, Clock, Trash2, CheckCircle2, TrendingUp, Briefcase, Activity, Calendar, Award } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts"


// ─── Departments Tab ─────────────────────────────────────────────────────────
const DepartmentsTab = () => {
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null) // null | "create" | dept object
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/departments`)
      setDepartments(res.data.departments)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({ name: "", description: "" })
    setModal("create")
  }

  const openEdit = (dept) => {
    setForm({ name: dept.name, description: dept.description || "" })
    setModal(dept)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal === "create") {
        await axios.post(`${API_BASE}/api/departments`, form)
      } else {
        await axios.put(`${API_BASE}/api/departments/${modal._id}`, form)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-52" />
          </div>
          <Skeleton className="h-9 w-36" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 pb-2 border-b border-border/50">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-3" />)}
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 py-2">
                {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-4" />)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Departments
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-mono">
              {departments.length}
            </Badge>
          </CardTitle>
          <CardDescription>Configure the main business functions</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 font-semibold shadow-sm">
          <Plus className="h-4 w-4" /> New Department
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Description</TableHead>
                <TableHead className="font-semibold text-foreground/80">Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm">No departments created yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                departments.map(d => (
                  <TableRow key={d._id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold text-sm text-foreground/90">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.description || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      {new Date(d.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(d)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        {modal && (
          <DialogContent className="sm:max-w-[425px] border-border/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Building2 className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create Department" : `Edit: ${modal.name}`}
              </DialogTitle>
              <DialogDescription>Define a functional group for task organization</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="dept-name" className="text-foreground/80 font-medium">Department Name *</Label>
                <Input
                  id="dept-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Engineering"
                  className="h-10 rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dept-desc" className="text-foreground/80 font-medium">Description</Label>
                <Input
                  id="dept-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Functional responsibilities..."
                  className="h-10 rounded-lg"
                />
              </div>
              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg h-10 font-semibold shadow" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

// ─── Teams Tab ──────────────────────────────────────────────────────────────
const TeamsTab = () => {
  const [teams, setTeams] = useState([])
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: "", department: "" })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        axios.get(`${API_BASE}/api/teams`),
        axios.get(`${API_BASE}/api/departments`)
      ])
      setTeams(tRes.data.teams)
      setDepartments(dRes.data.departments)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({ name: "", department: "" })
    setModal("create")
  }

  const openEdit = (team) => {
    setForm({ name: team.name, department: team.department?._id || "" })
    setModal(team)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.department) return
    setSaving(true)
    try {
      if (modal === "create") {
        await axios.post(`${API_BASE}/api/teams`, form)
      } else {
        await axios.put(`${API_BASE}/api/teams/${modal._id}`, form)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-28" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-4 pb-2 border-b border-border/50">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-3" />)}
            </div>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 py-2">
                {[...Array(4)].map((_, j) => <Skeleton key={j} className="h-4" />)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Teams
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-mono">
              {teams.length}
            </Badge>
          </CardTitle>
          <CardDescription>Organize members into focus teams</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 font-semibold shadow-sm">
          <Plus className="h-4 w-4" /> New Team
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Department</TableHead>
                <TableHead className="font-semibold text-foreground/80">Created</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm">No teams created yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                teams.map(t => (
                  <TableRow key={t._id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold text-sm text-foreground/90">{t.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.department?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        {modal && (
          <DialogContent className="sm:max-w-[425px] border-border/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <Users className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create Team" : `Edit: ${modal.name}`}
              </DialogTitle>
              <DialogDescription>Group employees within a specific department</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="team-name" className="text-foreground/80 font-medium">Team Name *</Label>
                <Input
                  id="team-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Frontend Core"
                  className="h-10 rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="team-dept" className="mb-1 text-foreground/80 font-medium">Department *</Label>
                <Select
                  value={form.department}
                  onValueChange={val => setForm(f => ({ ...f, department: val }))}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="— Select Department —" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d._id} value={d._id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg h-10 font-semibold shadow" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

// ─── Users Tab ──────────────────────────────────────────────────────────────
const ROLE_VARIANTS = {
  super_admin: "violet",
  manager: "info",
  employee: "secondary"
}

const ROLE_LABELS = {
  super_admin: "Super Admin",
  manager: "Manager",
  employee: "Employee"
}

const UsersTab = () => {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [teams, setTeams] = useState([])
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "employee",
    department: "", team: "", manager: ""
  })
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [onboardedUser, setOnboardedUser] = useState(null)
  const [newDeptName, setNewDeptName] = useState("")
  const [newTeamName, setNewTeamName] = useState("")
  const [showNewDeptInput, setShowNewDeptInput] = useState(false)
  const [showNewTeamInput, setShowNewTeamInput] = useState(false)

  const handleCreateDeptInline = async () => {
    if (!newDeptName.trim()) return
    setSaving(true)
    try {
      const res = await axios.post(`${API_BASE}/api/departments`, { name: newDeptName.trim(), description: "Created during user onboarding" })
      const dRes = await axios.get(`${API_BASE}/api/departments`)
      setDepartments(dRes.data.departments)
      const newDeptId = res.data.department?._id || res.data.department || ""
      setForm(f => ({ ...f, department: newDeptId, team: "" }))
      setNewDeptName("")
      setShowNewDeptInput(false)
    } catch (err) {
      console.error("Error creating inline department:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateTeamInline = async () => {
    if (!newTeamName.trim() || !form.department) return
    setSaving(true)
    try {
      const res = await axios.post(`${API_BASE}/api/teams`, { name: newTeamName.trim(), department: form.department })
      const tRes = await axios.get(`${API_BASE}/api/teams`)
      setTeams(tRes.data.teams)
      const newTeamId = res.data.team?._id || res.data.team || ""
      setForm(f => ({ ...f, team: newTeamId }))
      setNewTeamName("")
      setShowNewTeamInput(false)
    } catch (err) {
      console.error("Error creating inline team:", err)
    } finally {
      setSaving(false)
    }
  }

  const generatePasswordInline = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    let generated = ""
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setForm(f => ({ ...f, password: generated }))
  }

  const load = async () => {
    try {
      const [uRes, dRes, tRes] = await Promise.all([
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/departments`),
        axios.get(`${API_BASE}/api/teams`)
      ])
      setUsers(uRes.data.users)
      setDepartments(dRes.data.departments)
      setTeams(tRes.data.teams)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({
      name: "", email: "", password: "", role: "employee",
      department: "", team: "", manager: ""
    })
    setOnboardingStep(1)
    setModal("create")
  }

  const openEdit = (u) => {
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      department: u.department?._id || "",
      team: u.team?._id || "",
      manager: u.manager?._id || ""
    })
    setModal(u)
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    if (modal !== "create" && !payload.password) {
      delete payload.password
    }

    try {
      if (modal === "create") {
        const res = await axios.post(`${API_BASE}/api/users`, payload)
        setOnboardedUser({ ...res.data.user, rawPassword: form.password })
        await load()
        setOnboardingStep(4) // Move to completion step
      } else {
        await axios.put(`${API_BASE}/api/users/${modal._id}`, payload)
        await load()
        setModal(null)
      }
    } catch (err) {
      console.error("Error saving user:", err)
    } finally {
      setSaving(false)
    }
  }

  // Filter teams list dynamically based on chosen department
  const filteredTeams = form.department
    ? teams.filter(t => t.department?._id === form.department || t.department === form.department)
    : []

  const managers = users.filter(u => u.role === "manager")

  if (loading) {
    return (
      <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-44" />
          </div>
          <Skeleton className="h-9 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-4 pb-2 border-b border-border/50">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-3" />)}
            </div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="grid grid-cols-6 gap-4 py-2">
                {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-4" />)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/40 shadow-lg bg-card/30 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            Users
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-mono">
              {users.length}
            </Badge>
          </CardTitle>
          <CardDescription>Manage user credentials, organization units, and assignments</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5 font-semibold shadow-sm">
          <Plus className="h-4 w-4" /> New User
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Email</TableHead>
                <TableHead className="font-semibold text-foreground/80">Role</TableHead>
                <TableHead className="font-semibold text-foreground/80">Department</TableHead>
                <TableHead className="font-semibold text-foreground/80">Team</TableHead>
                <TableHead className="font-semibold text-foreground/80">Manager</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="h-5 w-5" />
                      <span className="text-sm">No users registered yet.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => {
                  const initials = u.name ? u.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "US"
                  return (
                    <TableRow key={u._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">
                            {initials}
                          </div>
                          <span>{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm py-4">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground/85" />
                          {u.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANTS[u.role] || "outline"} className="capitalize text-[10px] py-0.5 px-2 rounded-md font-bold">
                          {ROLE_LABELS[u.role] || u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.department?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.team?.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{u.manager?.name || "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={modal !== null} onOpenChange={() => { setModal(null); setOnboardedUser(null); }}>
        {modal && (
          <DialogContent className="sm:max-w-[480px] border-border/60">
            {modal === "create" ? (
              // ── Onboarding Wizard (Create Mode) ──
              <div>
                <DialogHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                      <UserPlus className="h-5 w-5 text-primary" />
                      {onboardingStep === 4 ? "Onboarding Complete!" : `Onboard User (Step ${onboardingStep} of 3)`}
                    </DialogTitle>
                    {onboardingStep < 4 && (
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-lg border">
                        {onboardingStep === 1 ? "Credentials" : onboardingStep === 2 ? "Organization" : "Report"}
                      </span>
                    )}
                  </div>
                  <DialogDescription>
                    {onboardingStep === 1 && "Set up credentials and security options."}
                    {onboardingStep === 2 && "Configure department and team assignments."}
                    {onboardingStep === 3 && "Assign reporting line manager."}
                    {onboardingStep === 4 && "Employee account has been successfully created."}
                  </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                  {onboardingStep === 1 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="user-name" className="text-foreground/80 font-medium">Name *</Label>
                          <Input
                            id="user-name"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="Jane Doe"
                            className="h-10 rounded-lg"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="user-email" className="text-foreground/80 font-medium">Email Address *</Label>
                          <Input
                            type="email"
                            id="user-email"
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="jane@company.com"
                            className="h-10 rounded-lg"
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <Label htmlFor="user-pw" className="text-foreground/80 font-medium">Password *</Label>
                          <button
                            type="button"
                            onClick={generatePasswordInline}
                            className="text-[10px] text-primary hover:underline font-bold"
                          >
                            ⚡ Auto-Generate
                          </button>
                        </div>
                        <Input
                          type="text"
                          id="user-pw"
                          value={form.password}
                          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="Password characters..."
                          className="h-10 rounded-lg font-mono text-sm"
                          required
                        />
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                        <Label htmlFor="user-role" className="mb-1 text-foreground/80 font-medium">Role *</Label>
                        <Select
                          value={form.role}
                          onValueChange={val => setForm(f => ({ ...f, role: val, manager: "" }))}
                        >
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="Select Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">
                              <span className="flex items-center gap-1.5">
                                👤 Employee
                              </span>
                            </SelectItem>
                            <SelectItem value="manager">
                              <span className="flex items-center gap-1.5">
                                🔷 Manager
                              </span>
                            </SelectItem>
                            <SelectItem value="super_admin">
                              <span className="flex items-center gap-1.5">
                                👑 Super Admin
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {onboardingStep === 2 && (
                    <div className="space-y-4">
                      {/* Department Select & Inline creation */}
                      <div className="space-y-2 flex flex-col">
                        <div className="flex justify-between items-center">
                          <Label className="text-foreground/80 font-medium">Department</Label>
                          {!showNewDeptInput && (
                            <button
                              type="button"
                              onClick={() => setShowNewDeptInput(true)}
                              className="text-[10px] text-primary hover:underline font-bold"
                            >
                              + New Department inline
                            </button>
                          )}
                        </div>
                        
                        {showNewDeptInput ? (
                          <div className="flex gap-2 items-center bg-muted/40 p-2 rounded-lg border border-border/40 animate-in slide-in-from-top-1 duration-200">
                            <Input
                              placeholder="e.g. Sales"
                              value={newDeptName}
                              onChange={e => setNewDeptName(e.target.value)}
                              className="h-8 text-xs rounded-md"
                            />
                            <Button size="sm" type="button" className="h-8 text-xs rounded-md" onClick={handleCreateDeptInline}>Save</Button>
                            <Button size="sm" type="button" variant="ghost" className="h-8 text-xs rounded-md" onClick={() => { setShowNewDeptInput(false); setNewDeptName(""); }}>Cancel</Button>
                          </div>
                        ) : (
                          <Select
                            value={form.department || "none"}
                            onValueChange={val => setForm(f => ({ ...f, department: val === "none" ? "" : val, team: "" }))}
                          >
                            <SelectTrigger className="h-10 rounded-lg">
                              <SelectValue placeholder="— None —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {departments.map(d => (
                                <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Team Select & Inline creation */}
                      <div className="space-y-2 flex flex-col">
                        <div className="flex justify-between items-center">
                          <Label className="text-foreground/80 font-medium">Team</Label>
                          {!showNewTeamInput && form.department && (
                            <button
                              type="button"
                              onClick={() => setShowNewTeamInput(true)}
                              className="text-[10px] text-primary hover:underline font-bold"
                            >
                              + New Team inline
                            </button>
                          )}
                        </div>

                        {showNewTeamInput ? (
                          <div className="flex gap-2 items-center bg-muted/40 p-2 rounded-lg border border-border/40 animate-in slide-in-from-top-1 duration-200">
                            <Input
                              placeholder="e.g. Inside Sales"
                              value={newTeamName}
                              onChange={e => setNewTeamName(e.target.value)}
                              className="h-8 text-xs rounded-md"
                            />
                            <Button size="sm" type="button" className="h-8 text-xs rounded-md" onClick={handleCreateTeamInline}>Save</Button>
                            <Button size="sm" type="button" variant="ghost" className="h-8 text-xs rounded-md" onClick={() => { setShowNewTeamInput(false); setNewTeamName(""); }}>Cancel</Button>
                          </div>
                        ) : (
                          <Select
                            value={form.team || "none"}
                            onValueChange={val => setForm(f => ({ ...f, team: val === "none" ? "" : val }))}
                            disabled={!form.department}
                          >
                            <SelectTrigger className="h-10 rounded-lg">
                              <SelectValue placeholder="— None —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {filteredTeams.map(t => (
                                <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  )}

                  {onboardingStep === 3 && (
                    <div className="space-y-4">
                      {form.role === "employee" ? (
                        <div className="space-y-2 flex flex-col">
                          <Label htmlFor="user-manager" className="text-foreground/80 font-medium">Reporting Line Manager</Label>
                          <Select
                            value={form.manager || "none"}
                            onValueChange={val => setForm(f => ({ ...f, manager: val === "none" ? "" : val }))}
                          >
                            <SelectTrigger className="h-10 rounded-lg">
                              <SelectValue placeholder="— None —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— None —</SelectItem>
                              {managers.map(m => {
                                const initials = m.name ? m.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "M"
                                return (
                                  <SelectItem key={m._id} value={m._id}>
                                    <span className="flex items-center gap-2">
                                      <span className="h-4 w-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold flex items-center justify-center">
                                        {initials}
                                      </span>
                                      {m.name}
                                    </span>
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="bg-muted/30 p-4 rounded-xl border border-border/20 text-center">
                          <p className="text-sm text-muted-foreground italic">Reporting lines only apply to the Employee role.</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">This user is configured as a "{ROLE_LABELS[form.role]}".</p>
                        </div>
                      )}

                      <div className="border border-border/50 rounded-xl p-3 bg-muted/10 space-y-2 text-xs">
                        <div className="font-bold text-foreground/80 border-b border-border/30 pb-1.5">Review Account Details:</div>
                        <div>Name: <span className="font-semibold text-foreground">{form.name || "—"}</span></div>
                        <div>Email: <span className="font-semibold text-foreground">{form.email || "—"}</span></div>
                        <div>Password: <span className="font-mono text-primary">{form.password || "—"}</span></div>
                        <div>Role: <span className="capitalize font-semibold text-foreground">{ROLE_LABELS[form.role]}</span></div>
                        <div>Department: <span className="font-semibold text-foreground">{departments.find(d => d._id === form.department)?.name || "—"}</span></div>
                        <div>Team: <span className="font-semibold text-foreground">{teams.find(t => t._id === form.team)?.name || "—"}</span></div>
                        {form.role === "employee" && (
                          <div>Reports To: <span className="font-semibold text-foreground">{managers.find(m => m._id === form.manager)?.name || "—"}</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {onboardingStep === 4 && onboardedUser && (
                    <div className="space-y-4 animate-in zoom-in duration-200">
                      <div className="flex flex-col items-center justify-center text-center p-4 bg-green-500/10 border border-green-500/25 rounded-2xl gap-2">
                        <span className="h-10 w-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center text-lg font-bold">✓</span>
                        <h4 className="font-bold text-foreground text-sm">Account Configured Successfully</h4>
                        <p className="text-xs text-muted-foreground max-w-[280px]">Provide the following login credentials to the user.</p>
                      </div>

                      <div className="border border-border/50 rounded-xl p-4 bg-muted/20 space-y-3 font-mono text-xs select-all">
                        <div className="flex justify-between border-b border-border/30 pb-2">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-bold text-foreground">{onboardedUser.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Password:</span>
                          <span className="font-bold text-primary">{onboardedUser.rawPassword}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2 gap-2 border-t border-border/20">
                  {onboardingStep === 1 && (
                    <>
                      <Button type="button" variant="ghost" className="rounded-lg h-9 text-xs" onClick={() => setModal(null)}>Cancel</Button>
                      <Button type="button" className="rounded-lg h-9 text-xs font-semibold shadow" onClick={() => setOnboardingStep(2)} disabled={!form.name || !form.email || !form.password}>Next</Button>
                    </>
                  )}
                  {onboardingStep === 2 && (
                    <>
                      <Button type="button" variant="ghost" className="rounded-lg h-9 text-xs" onClick={() => setOnboardingStep(1)}>Back</Button>
                      <Button type="button" className="rounded-lg h-9 text-xs font-semibold shadow" onClick={() => setOnboardingStep(3)}>Next</Button>
                    </>
                  )}
                  {onboardingStep === 3 && (
                    <>
                      <Button type="button" variant="ghost" className="rounded-lg h-9 text-xs" onClick={() => setOnboardingStep(2)}>Back</Button>
                      <Button type="button" className="rounded-lg h-9 text-xs font-semibold shadow bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSubmit} disabled={saving}>
                        {saving ? "Creating…" : "Onboard Employee"}
                      </Button>
                    </>
                  )}
                  {onboardingStep === 4 && (
                    <Button type="button" className="w-full rounded-lg h-10 font-bold shadow bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setModal(null); setOnboardedUser(null); }}>
                      Finish & Close
                    </Button>
                  )}
                </DialogFooter>
              </div>
            ) : (
              // ── Simple Edit Mode (Standard Form) ──
              <div>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                    <UserPlus className="h-5 w-5 text-primary" />
                    Edit User: {modal.name}
                  </DialogTitle>
                  <DialogDescription>Assign organizational mappings and manager reporting lines</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="user-name" className="text-foreground/80 font-medium">Name *</Label>
                      <Input
                        id="user-name"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Jane Doe"
                        className="h-10 rounded-lg"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="user-email" className="text-foreground/80 font-medium">Email Address *</Label>
                      <Input
                        type="email"
                        id="user-email"
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="jane@company.com"
                        className="h-10 rounded-lg"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="user-pw" className="text-foreground/80 font-medium">New Password (leave blank to keep)</Label>
                    <Input
                      type="password"
                      id="user-pw"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="••••••••"
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                      <Label htmlFor="user-role" className="mb-1 text-foreground/80 font-medium">Role *</Label>
                      <Select
                        value={form.role}
                        onValueChange={val => setForm(f => ({ ...f, role: val, manager: "" }))}
                      >
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="employee">
                            <span className="flex items-center gap-1.5">
                              👤 Employee
                            </span>
                          </SelectItem>
                          <SelectItem value="manager">
                            <span className="flex items-center gap-1.5">
                              🔷 Manager
                            </span>
                          </SelectItem>
                          <SelectItem value="super_admin">
                            <span className="flex items-center gap-1.5">
                              👑 Super Admin
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 flex flex-col">
                      <Label htmlFor="user-dept" className="mb-1 text-foreground/80 font-medium">Department</Label>
                      <Select
                        value={form.department || "none"}
                        onValueChange={val => setForm(f => ({ ...f, department: val === "none" ? "" : val, team: "" }))}
                      >
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {departments.map(d => (
                            <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 flex flex-col">
                      <Label htmlFor="user-team" className="mb-1 text-foreground/80 font-medium">Team</Label>
                      <Select
                        value={form.team || "none"}
                        onValueChange={val => setForm(f => ({ ...f, team: val === "none" ? "" : val }))}
                        disabled={!form.department}
                      >
                        <SelectTrigger className="h-10 rounded-lg">
                          <SelectValue placeholder="— None —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {filteredTeams.map(t => (
                            <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.role === "employee" ? (
                      <div className="space-y-1.5 flex flex-col">
                        <Label htmlFor="user-manager" className="mb-1 text-foreground/80 font-medium">Manager</Label>
                        <Select
                          value={form.manager || "none"}
                          onValueChange={val => setForm(f => ({ ...f, manager: val === "none" ? "" : val }))}
                        >
                          <SelectTrigger className="h-10 rounded-lg">
                            <SelectValue placeholder="— None —" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— None —</SelectItem>
                            {managers.map(m => {
                              const initials = m.name ? m.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "M"
                              return (
                                <SelectItem key={m._id} value={m._id}>
                                  <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold flex items-center justify-center">
                                      {initials}
                                    </span>
                                    {m.name}
                                  </span>
                                </SelectItem>
                              )
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 flex flex-col justify-end">
                        <p className="text-[10px] text-muted-foreground pb-2 italic">Reporting lines apply to Employees only.</p>
                      </div>
                    )}
                  </div>
                  <DialogFooter className="pt-4 gap-2">
                    <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setModal(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="rounded-lg h-10 font-semibold shadow" disabled={saving}>
                      {saving ? "Saving…" : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </form>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}



// ─── Task Templates Tab ──────────────────────────────────────────────────────
const TaskTemplatesTab = () => {
  const [templates, setTemplates] = useState([])
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null) // null | "create" | template object
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Daily",
    priority: "medium",
    estimatedHours: 1,
    scope: "global",
    departments: []
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [tplRes, deptRes] = await Promise.all([
        axios.get(`${API_BASE}/api/task-templates`),
        axios.get(`${API_BASE}/api/departments`)
      ])
      setTemplates(tplRes.data.templates)
      setDepartments(deptRes.data.departments)
    } catch (err) {
      console.error("Error loading task templates:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({
      title: "",
      description: "",
      category: "Daily",
      priority: "medium",
      estimatedHours: 1,
      scope: "global",
      departments: []
    })
    setModal("create")
  }

  const openEdit = (tpl) => {
    setForm({
      title: tpl.title,
      description: tpl.description || "",
      category: tpl.category || "Daily",
      priority: tpl.priority || "medium",
      estimatedHours: tpl.estimatedHours || 1,
      scope: tpl.scope || "global",
      departments: tpl.departments?.map(d => d._id) || []
    })
    setModal(tpl)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.scope === "department" && form.departments.length === 0) {
      alert("Please select at least one department.")
      return
    }
    setSaving(true)
    try {
      if (modal === "create") {
        await axios.post(`${API_BASE}/api/task-templates`, form)
      } else {
        await axios.put(`${API_BASE}/api/task-templates/${modal._id}`, form)
      }
      await load()
      setModal(null)
    } catch (err) {
      console.error("Error saving template:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      await axios.delete(`${API_BASE}/api/task-templates/${id}`)
      await load()
    } catch (err) {
      console.error("Error deleting template:", err)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-44" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const PRIORITY_BADGES = {
    low: "secondary",
    medium: "default",
    high: "destructive"
  }

  return (
    <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Repeat className="h-5 w-5 text-primary" /> Daily Task Templates
          </CardTitle>
          <CardDescription>Create daily recurring tasks that auto-populate on employee dashboards each day.</CardDescription>
        </div>
        <Button onClick={openCreate} className="gap-2 font-semibold shadow glow-primary self-start sm:self-auto">
          <Plus className="h-4 w-4" /> Add Template
        </Button>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
              <Repeat className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-foreground">No recurring templates</h4>
              <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
                Click "Add Template" to configure global or department-specific recurring tasks.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(t => (
              <Card key={t._id} className="border-border/50 bg-background/30 hover:border-primary/30 hover:shadow-md transition-all relative group overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold uppercase mb-1 flex items-center w-max gap-0.5">
                        <Repeat className="h-2.5 w-2.5" /> Recurring
                      </Badge>
                      <h4 className="font-bold text-foreground line-clamp-1">{t.title}</h4>
                    </div>
                    <Badge variant={PRIORITY_BADGES[t.priority] || "default"} className="text-[10px] py-0 px-1.5 capitalize shrink-0 font-bold">
                      {t.priority}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3 text-xs space-y-3">
                  <p className="text-muted-foreground line-clamp-2 h-8 leading-relaxed">
                    {t.description || "No description provided."}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border/40 pt-2 text-[11px] text-muted-foreground font-semibold uppercase">
                    <div>Scope: <span className="text-foreground font-bold">{t.scope}</span></div>
                    {t.scope === "department" && (
                      <div className="text-violet-400">Depts: <span className="font-bold text-violet-400">{t.departments?.map(d => d.name).join(", ") || "—"}</span></div>
                    )}
                    <div>Est: <span className="text-foreground font-bold">{t.estimatedHours}h</span></div>
                  </div>
                </CardContent>
                <div className="flex items-center justify-end border-t border-border/30 px-4 py-2 gap-2 bg-muted/20">
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-destructive/10" onClick={() => handleDelete(t._id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        {modal && (
          <DialogContent className="max-w-md bg-card/95 backdrop-blur shadow-2xl border-border/50">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {modal === "create" ? "Create Task Template" : "Edit Task Template"}
              </DialogTitle>
              <DialogDescription>Setup recurring tasks that appear on checklists daily.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-foreground/80 font-medium">Task Title *</Label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Write Daily Sync Report"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 font-medium">Description</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief details about what needs to be completed..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Category</Label>
                  <Input
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Daily Check"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Priority</Label>
                  <select
                    value={form.priority}
                    onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="low" className="bg-card text-foreground">Low</option>
                    <option value="medium" className="bg-card text-foreground">Medium</option>
                    <option value="high" className="bg-card text-foreground">High</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Est. Hours</Label>
                  <Input
                    type="number"
                    value={form.estimatedHours}
                    onChange={e => setForm(f => ({ ...f, estimatedHours: Number(e.target.value) }))}
                    min="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Scope</Label>
                  <select
                    value={form.scope}
                    onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="global" className="bg-card text-foreground">Global (All Employees)</option>
                    <option value="department" className="bg-card text-foreground">Department Specific</option>
                  </select>
                </div>
              </div>

              {form.scope === "department" && (
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Target Departments *</Label>
                  <div className="border border-border/40 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 bg-background/25">
                    {departments.map(d => {
                      const isChecked = form.departments.includes(d._id)
                      return (
                        <label key={d._id} className="flex items-center gap-2 text-xs font-semibold text-foreground/80 hover:text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newDepts = isChecked
                                ? form.departments.filter(id => id !== d._id)
                                : [...form.departments, d._id]
                              setForm(f => ({ ...f, departments: newDepts }))
                            }}
                            className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 bg-transparent"
                          />
                          <span>{d.name}</span>
                        </label>
                      )
                    })}
                  </div>
                  {form.departments.length === 0 && (
                    <p className="text-[10px] text-destructive font-medium">* Select at least one department</p>
                  )}
                </div>
              )}

              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="rounded-lg h-10 font-semibold shadow" disabled={saving}>
                  {saving ? "Saving…" : "Save Template"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────
const ReportsTab = () => {
  const [reports, setReports] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState("employees")
  const [timeframe, setTimeframe] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
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
      setReports(res.data)
    } catch (err) {
      console.error("Error loading progress reports:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [timeframe, startDate, endDate])

  const formatHours = (seconds) => {
    if (!seconds) return "0.0h"
    return (seconds / 3600).toFixed(1) + "h"
  }

  if (loading || !reports) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl w-full" />
      </div>
    )
  }

  const { employeeReport, departmentReport, teamReport, healthReport, priorityReport } = reports

  // --- Prepare chart datasets ---
  const statusData = [
    { name: "Not Started", value: healthReport.notStartedTasks, color: "#94a3b8" },
    { name: "In Progress", value: healthReport.inProgressTasks, color: "#38bdf8" },
    { name: "Waiting Review", value: healthReport.waitingReviewTasks, color: "#fb7185" },
    { name: "Completed", value: healthReport.completedTasks, color: "#4ade80" },
    { name: "Rejected", value: healthReport.rejectedTasks, color: "#f87171" }
  ].filter(d => d.value > 0)

  const deptHoursData = departmentReport.map(d => ({
    name: d.name,
    hours: parseFloat((d.totalTrackedSeconds / 3600).toFixed(1))
  }))

  return (
    <div className="space-y-8">
      {/* Timeframe Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-card/25 backdrop-blur-sm shadow-md">
        <div className="flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-bold text-foreground/95">Report Timeframe:</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={timeframe} onValueChange={(val) => {
            setTimeframe(val)
            if (val !== "custom") {
              setStartDate("")
              setEndDate("")
            }
          }}>
            <SelectTrigger className="h-9 w-40 rounded-lg text-xs font-semibold animate-shimmer">
              <SelectValue placeholder="All Time" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📁 All Time</SelectItem>
              <SelectItem value="today">⚡ Today</SelectItem>
              <SelectItem value="week">📅 Last 7 Days</SelectItem>
              <SelectItem value="month">🗓️ Last 30 Days</SelectItem>
              <SelectItem value="custom">⚙️ Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {timeframe === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-xs rounded-lg w-36 bg-background/30"
              />
              <span className="text-xs text-muted-foreground font-semibold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-xs rounded-lg w-36 bg-background/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Org Tasks</CardTitle>
            <Briefcase className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{healthReport.totalTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Total active work items</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Org Completion Rate</CardTitle>
            <TrendingUp className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-green-400">{healthReport.avgCompletionRate}%</div>
            <div className="w-full bg-muted rounded-full h-1 mt-2">
              <div className="bg-green-500 h-full rounded-full" style={{ width: `${healthReport.avgCompletionRate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracked Time</CardTitle>
            <Clock className="h-4.5 w-4.5 text-violet-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-violet-400">{formatHours(healthReport.totalTrackedSeconds)}</div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative time recorded</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-md" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overdue Items</CardTitle>
            <AlertTriangle className={`h-4.5 w-4.5 ${healthReport.overdueTasks > 0 ? "text-amber-500 animate-bounce" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-amber-400">{healthReport.overdueTasks}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Report Container */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-4 gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Multi-Dimensional Performance Report
            </CardTitle>
            <CardDescription>Track employee metrics, department efficiency, and productivity indicators.</CardDescription>
          </div>

          {/* Sub Navigation pills */}
          <div className="flex flex-wrap bg-muted/65 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
            <Button
              variant={activeSubTab === "employees" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("employees")}
            >
              Employees
            </Button>
            <Button
              variant={activeSubTab === "departments" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("departments")}
            >
              Departments
            </Button>
            <Button
              variant={activeSubTab === "teams" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("teams")}
            >
              Teams
            </Button>
            <Button
              variant={activeSubTab === "analytics" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("analytics")}
            >
              Analytics
            </Button>
            <Button
              variant={activeSubTab === "insights" ? "default" : "ghost"}
              className="rounded-lg text-xs h-8 font-bold px-3"
              onClick={() => setActiveSubTab("insights")}
            >
              Insights
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {activeSubTab === "employees" && (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground/80">Employee</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Dept & Team</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Tasks</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Completion Rate</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-right">Avg Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeReport.map(e => (
                    <TableRow key={e._id} onClick={() => setSelectedEmployee(e)} className="hover:bg-muted/30 transition-colors cursor-pointer">
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-foreground/90">{e.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{e.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-foreground/80">{e.department}</span>
                          <span className="text-xs font-medium text-muted-foreground/80">{e.team}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        <div className="flex items-center justify-center gap-1.5">
                          <Badge variant="outline" className="font-mono h-5 py-0 px-1.5 font-bold rounded-sm border-border">{e.total}</Badge>
                          {e.overdue > 0 && (
                            <Badge variant="destructive" className="h-5 py-0 px-1 font-bold rounded-sm text-[9px] uppercase">
                              {e.overdue} Late
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center justify-center gap-1 max-w-[100px] mx-auto">
                          <span className="font-mono text-xs font-bold text-foreground">{e.completionRate}%</span>
                          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${e.completionRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(e.totalTrackedSeconds)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground/80 text-sm">{e.avgProgress}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {activeSubTab === "departments" && (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground/80">Department</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Active Members</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Total Tasks</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-right">Completion Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentReport.map(d => (
                    <TableRow key={d.deptId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm font-bold text-foreground/90">{d.name}</TableCell>
                      <TableCell className="text-center font-bold text-sm">{d.memberCount}</TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{d.total}</span>
                          {d.overdue > 0 && <Badge variant="destructive" className="h-4 py-0 px-1 font-bold text-[8px] uppercase">{d.overdue} Overdue</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(d.totalTrackedSeconds)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1 max-w-[120px] ml-auto">
                          <span className="font-mono text-xs font-bold text-foreground">{d.completionRate}%</span>
                          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                            <div className="bg-green-500 h-full rounded-full" style={{ width: `${d.completionRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {activeSubTab === "teams" && (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground/80">Team</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Active Members</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Total Tasks</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Tracked Hours</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-right">Completion Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamReport.map(t => (
                    <TableRow key={t.teamId} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-sm font-bold text-foreground/90">{t.name}</TableCell>
                      <TableCell className="text-center font-bold text-sm">{t.memberCount}</TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        <div className="flex items-center justify-center gap-1.5">
                          <span>{t.total}</span>
                          {t.overdue > 0 && <Badge variant="destructive" className="h-4 py-0 px-1 font-bold text-[8px] uppercase">{t.overdue} Overdue</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold text-violet-400">{formatHours(t.totalTrackedSeconds)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1 max-w-[120px] ml-auto">
                          <span className="font-mono text-xs font-bold text-foreground">{t.completionRate}%</span>
                          <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${t.completionRate}%` }} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {activeSubTab === "analytics" && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Task Status Donut Chart */}
              <Card className="border-border/50 bg-background/25 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-primary" /> Task Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {statusData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No tasks in this period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: "#151525", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px", color: "#f8fafc" }}
                        />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: "10px", fontWeight: "bold" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Department Tracked Hours Bar Chart */}
              <Card className="border-border/50 bg-background/25 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-violet-400" /> Tracked Hours by Department
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  {deptHoursData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No hours tracked in this period</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deptHoursData}>
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip
                          cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          contentStyle={{ backgroundColor: "#151525", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "11px", color: "#f8fafc" }}
                        />
                        <Bar dataKey="hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tracked Hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSubTab === "insights" && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Insight Card: Alert Center */}
              <Card className="border-border/50 bg-background/25 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-amber-400" /> Organizational Risks & Bottlenecks
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {healthReport.overdueTasks > 0 ? (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/25 bg-amber-500/5">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <h5 className="font-bold text-amber-400">Overdue Task Alert</h5>
                        <p className="text-muted-foreground leading-relaxed">
                          There are currently <strong className="text-foreground">{healthReport.overdueTasks} overdue tasks</strong>. Review the employee dashboard summary to re-evaluate priorities.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-green-500/25 bg-green-500/5 text-center text-xs text-green-400 font-bold">
                      ✓ No overdue items identified across the organization.
                    </div>
                  )}

                  {employeeReport.filter(e => e.total > 0 && e.completionRate < 30).length > 0 && (
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/25 bg-destructive/5">
                      <Activity className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <h5 className="font-bold text-destructive">Completion Bottlenecks</h5>
                        <p className="text-muted-foreground leading-relaxed">
                          Certain employees have completion rates under 30% on active work items. Review resource allocation or blocker comments.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Insight Card: Task Priority Distribution */}
              <Card className="border-border/50 bg-background/25 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-violet-400" /> Work Load Priority Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3.5">
                    {priorityReport.map(pr => {
                      const percentage = healthReport.totalTasks > 0 ? Math.round((pr.total / healthReport.totalTasks) * 100) : 0
                      const barColors = { high: "bg-destructive", medium: "bg-primary", low: "bg-secondary" }
                      return (
                        <div key={pr.priority} className="space-y-1 text-xs">
                          <div className="flex items-center justify-between font-semibold">
                            <span className="capitalize">{pr.priority} Priority</span>
                            <span>{pr.total} tasks ({percentage}%)</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div className={`${barColors[pr.priority]} h-full rounded-full`} style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Detail Drilldown Modal */}
      <Dialog open={selectedEmployee !== null} onOpenChange={() => setSelectedEmployee(null)}>
        {selectedEmployee && (
          <DialogContent className="max-w-2xl bg-card/95 backdrop-blur shadow-2xl border-border/50 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Employee Performance Detail: {selectedEmployee.name}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs text-muted-foreground">
                {selectedEmployee.email} • {selectedEmployee.department} — {selectedEmployee.team}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Detailed Performance Metrics Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Tasks Completed</div>
                  <div className="text-xl font-black text-green-400 mt-1">
                    {selectedEmployee.completed ?? 0} / {selectedEmployee.total ?? 0}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">({selectedEmployee.completionRate ?? 0}% Rate)</div>
                </div>

                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Avg. Resolution Velocity</div>
                  <div className="text-xl font-black text-primary mt-1">
                    {selectedEmployee.avgResolutionDays ?? 0} Days
                  </div>
                  <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">From creation to completion</div>
                </div>

                <div className="bg-muted/30 border border-border/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide">Estimation Accuracy</div>
                  <div className="text-xl font-black text-violet-400 mt-1">
                    {selectedEmployee.estimationAccuracy ?? 100}%
                  </div>
                  <div className="text-[9px] text-muted-foreground font-semibold mt-0.5">Estimated vs Tracked Hours</div>
                </div>
              </div>

              {/* Task Details List */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-1.5 border-b border-border/40 pb-2 text-foreground/90">
                  <Briefcase className="h-4 w-4 text-primary" /> Task Breakdown & Tracked Time
                </h4>
                {!selectedEmployee.tasks || selectedEmployee.tasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No tasks logged during this timeframe.</p>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 text-card-foreground">
                    {selectedEmployee.tasks.map(t => {
                      const trackedHrs = (t.totalTrackedSeconds / 3600).toFixed(1)
                      return (
                        <div key={t._id} className="border border-border/45 rounded-xl p-3 bg-muted/15 flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="font-bold text-foreground/95 flex items-center gap-2">
                              {t.title}
                              <Badge variant={t.priority === "high" ? "destructive" : "secondary"} className="text-[8px] py-0 px-1 font-bold tracking-wide uppercase">
                                {t.priority}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground line-clamp-1 text-[11px]">{t.description || "No description provided."}</p>
                            <div className="text-[9px] text-muted-foreground/80 font-medium">
                              Created: {new Date(t.createdAt).toLocaleDateString()}
                              {t.dueDate && ` • Due: ${new Date(t.dueDate).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <Badge className="font-bold uppercase tracking-wider text-[8px] scale-90 origin-right">
                              {t.status}
                            </Badge>
                            <div className="font-mono text-[10px] text-muted-foreground font-bold">
                              Tracked: <span className="text-violet-400">{trackedHrs}h</span> / {t.estimatedHours}h
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" className="rounded-lg" onClick={() => setSelectedEmployee(null)}>
                Close Details
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

// ─── Super Admin Dashboard ───────────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Super Admin Center
        </h2>
        <p className="text-muted-foreground">
          Welcome, <strong className="text-foreground">{user?.name}</strong>. Manage departments, teams, and user assignments.
        </p>
      </div>

      <Tabs defaultValue="departments" className="w-full space-y-6">
        <TabsList className="flex w-full max-w-[720px] border-b border-border bg-transparent p-0 rounded-none h-12 gap-6 overflow-x-auto">
          <TabsTrigger
            value="departments"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Users className="h-4 w-4" /> Teams
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger
            value="task-templates"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Repeat className="h-4 w-4" /> Task Templates
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="task-templates">
          <TaskTemplatesTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SuperAdminDashboard
