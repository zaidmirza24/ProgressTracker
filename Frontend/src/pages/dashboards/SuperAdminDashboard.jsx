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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, UserPlus, Pencil, AlertTriangle, User, Mail, Shield, Plus, AlertCircle } from "lucide-react"

// ─── Departments Tab ─────────────────────────────────────────────────────────
const DepartmentsTab = () => {
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null) // null | "create" | dept object
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await axios.get(`${API_BASE}/api/departments`)
    setDepartments(res.data.departments)
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

  const load = async () => {
    const [tRes, dRes] = await Promise.all([
      axios.get(`${API_BASE}/api/teams`),
      axios.get(`${API_BASE}/api/departments`)
    ])
    setTeams(tRes.data.teams)
    setDepartments(dRes.data.departments)
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
                <select
                  id="team-dept"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card text-foreground">— Select Department —</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id} className="bg-card text-foreground">{d.name}</option>
                  ))}
                </select>
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
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "employee",
    department: "", team: "", manager: ""
  })

  const load = async () => {
    const [uRes, dRes, tRes] = await Promise.all([
      axios.get(`${API_BASE}/api/users`),
      axios.get(`${API_BASE}/api/departments`),
      axios.get(`${API_BASE}/api/teams`)
    ])
    setUsers(uRes.data.users)
    setDepartments(dRes.data.departments)
    setTeams(tRes.data.teams)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({
      name: "", email: "", password: "", role: "employee",
      department: "", team: "", manager: ""
    })
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
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    if (modal !== "create" && !payload.password) {
      delete payload.password // don't send empty passwords on edit
    }

    try {
      if (modal === "create") {
        await axios.post(`${API_BASE}/api/users`, payload)
      } else {
        await axios.put(`${API_BASE}/api/users/${modal._id}`, payload)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  // Filter teams list dynamically based on chosen department
  const filteredTeams = form.department 
    ? teams.filter(t => t.department?._id === form.department || t.department === form.department)
    : []

  const managers = users.filter(u => u.role === "manager")

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

      <Dialog open={modal !== null} onOpenChange={() => setModal(null)}>
        {modal && (
          <DialogContent className="sm:max-w-[450px] border-border/60">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <UserPlus className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create User" : `Edit: ${modal.name}`}
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
                <Label htmlFor="user-pw" className="text-foreground/80 font-medium">{modal === "create" ? "Password *" : "New Password (leave blank to keep)"}</Label>
                <Input
                  type="password"
                  id="user-pw"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className="h-10 rounded-lg"
                  required={modal === "create"}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <Label htmlFor="user-role" className="mb-1 text-foreground/80 font-medium">Role *</Label>
                  <select
                    id="user-role"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value, manager: "" }))}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="employee" className="bg-card text-foreground">Employee</option>
                    <option value="manager" className="bg-card text-foreground">Manager</option>
                    <option value="super_admin" className="bg-card text-foreground">Super Admin</option>
                  </select>
                </div>
                <div className="space-y-1.5 flex flex-col">
                  <Label htmlFor="user-dept" className="mb-1 text-foreground/80 font-medium">Department</Label>
                  <select
                    id="user-dept"
                    value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value, team: "" }))}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" className="bg-card text-foreground">— None —</option>
                    {departments.map(d => (
                      <option key={d._id} value={d._id} className="bg-card text-foreground">{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 flex flex-col">
                  <Label htmlFor="user-team" className="mb-1 text-foreground/80 font-medium">Team</Label>
                  <select
                    id="user-team"
                    value={form.team}
                    onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                    disabled={!form.department}
                    className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="" className="bg-card text-foreground">— None —</option>
                    {filteredTeams.map(t => (
                      <option key={t._id} value={t._id} className="bg-card text-foreground">{t.name}</option>
                    ))}
                  </select>
                </div>
                {form.role === "employee" ? (
                  <div className="space-y-1.5 flex flex-col">
                    <Label htmlFor="user-manager" className="mb-1 text-foreground/80 font-medium">Manager</Label>
                    <select
                      id="user-manager"
                      value={form.manager}
                      onChange={e => setForm(f => ({ ...f, manager: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" className="bg-card text-foreground">— None —</option>
                      {managers.map(m => (
                        <option key={m._id} value={m._id} className="bg-card text-foreground">{m.name}</option>
                      ))}
                    </select>
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
        <TabsList className="flex w-full max-w-[450px] border-b border-border bg-transparent p-0 rounded-none h-12 gap-6">
          <TabsTrigger 
            value="departments" 
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground"
          >
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger 
            value="teams" 
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground"
          >
            <Users className="h-4 w-4" /> Teams
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground"
          >
            <UserPlus className="h-4 w-4" /> Users
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
      </Tabs>
    </div>
  )
}

export default SuperAdminDashboard
