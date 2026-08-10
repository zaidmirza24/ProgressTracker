import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Building2, Users, UserPlus, Pencil, AlertTriangle, User, Mail, Shield, Plus } from "lucide-react"

// ─── Departments Tab ─────────────────────────────────────────────────────────
const DepartmentsTab = () => {
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null) // null | "create" | dept object
  const [form, setForm] = useState({ name: "", description: "" })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await axios.get("http://localhost:3000/api/departments")
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
        await axios.post("http://localhost:3000/api/departments", form)
      } else {
        await axios.put(`http://localhost:3000/api/departments/${modal._id}`, form)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Departments
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {departments.length}
            </Badge>
          </CardTitle>
          <CardDescription>Configure the main business functions</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" /> New Department
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Description</TableHead>
                <TableHead className="font-semibold text-foreground/80">Created</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    No departments yet.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map(d => (
                  <TableRow key={d._id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create Department" : "Edit Department"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Name *</Label>
                <Input
                  id="dept-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-desc">Description</Label>
                <Input
                  id="dept-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
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

// ─── Teams Tab ───────────────────────────────────────────────────────────────
const TeamsTab = () => {
  const [teams, setTeams] = useState([])
  const [departments, setDepartments] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: "", department: "", description: "" })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [t, d] = await Promise.all([
      axios.get("http://localhost:3000/api/teams"),
      axios.get("http://localhost:3000/api/departments")
    ])
    setTeams(t.data.teams)
    setDepartments(d.data.departments)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setForm({ name: "", department: departments[0]?._id || "", description: "" })
    setModal("create")
  }

  const openEdit = (team) => {
    setForm({ name: team.name, department: team.department?._id || "", description: team.description || "" })
    setModal(team)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (modal === "create") {
        await axios.post("http://localhost:3000/api/teams", form)
      } else {
        await axios.put(`http://localhost:3000/api/teams/${modal._id}`, form)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Teams
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {teams.length}
            </Badge>
          </CardTitle>
          <CardDescription>Organize departments into functional units</CardDescription>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          disabled={departments.length === 0}
          className="gap-1"
        >
          <Plus className="h-4 w-4" /> New Team
        </Button>
      </CardHeader>
      <CardContent>
        {departments.length === 0 && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>Create at least one department before adding teams.</span>
          </div>
        )}

        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Department</TableHead>
                <TableHead className="font-semibold text-foreground/80">Description</TableHead>
                <TableHead className="font-semibold text-foreground/80">Created</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No teams yet.
                  </TableCell>
                </TableRow>
              ) : (
                teams.map(t => (
                  <TableRow key={t._id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal border-border/70 bg-card">
                        {t.department?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{t.description || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create Team" : "Edit Team"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="team-name">Name *</Label>
                <Input
                  id="team-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="team-dept" className="mb-1">Department *</Label>
                <select
                  id="team-dept"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="" className="bg-card">— Select —</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id} className="bg-card text-foreground">{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-desc">Description</Label>
                <Input
                  id="team-desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
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

// ─── Users Tab ───────────────────────────────────────────────────────────────
const ROLE_LABELS = { super_admin: "Super Admin", manager: "Manager", employee: "Employee" }
const ROLE_VARIANTS = { super_admin: "default", manager: "secondary", employee: "outline" }

const UsersTab = () => {
  const [users, setUsers] = useState([])
  const [departments, setDepartments] = useState([])
  const [teams, setTeams] = useState([])
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "employee", department: "", team: "", manager: "" })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [u, d, t] = await Promise.all([
      axios.get("http://localhost:3000/api/users"),
      axios.get("http://localhost:3000/api/departments"),
      axios.get("http://localhost:3000/api/teams")
    ])
    setUsers(u.data.users)
    setDepartments(d.data.departments)
    setTeams(t.data.teams)
  }

  useEffect(() => { load() }, [])

  const blankForm = { name: "", email: "", password: "", role: "employee", department: "", team: "", manager: "" }

  const openCreate = () => { setForm(blankForm); setModal("create") }

  const openEdit = (u) => {
    setForm({
      name: u.name, email: u.email, password: "",
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
    try {
      const payload = { ...form }
      if (!payload.password) delete payload.password
      if (modal === "create") {
        await axios.post("http://localhost:3000/api/users", payload)
      } else {
        await axios.put(`http://localhost:3000/api/users/${modal._id}`, payload)
      }
      await load()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  const managers = users.filter(u => u.role === "manager")
  const filteredTeams = form.department
    ? teams.filter(t => t.department?._id === form.department)
    : teams

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Users
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {users.length}
            </Badge>
          </CardTitle>
          <CardDescription>Manage user profiles and system access credentials</CardDescription>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1">
          <Plus className="h-4 w-4" /> New User
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border border-border/50 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground/80">Name</TableHead>
                <TableHead className="font-semibold text-foreground/80">Email</TableHead>
                <TableHead className="font-semibold text-foreground/80">Role</TableHead>
                <TableHead className="font-semibold text-foreground/80">Department</TableHead>
                <TableHead className="font-semibold text-foreground/80">Team</TableHead>
                <TableHead className="font-semibold text-foreground/80">Manager</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users yet.
                  </TableCell>
                </TableRow>
              ) : (
                users.map(u => (
                  <TableRow key={u._id} className="hover:bg-muted/30">
                    <TableCell className="font-medium flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {u.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground flex items-center gap-1.5 py-4">
                      <Mail className="h-3.5 w-3.5" />
                      {u.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ROLE_VARIANTS[u.role] || "outline"} className="capitalize">
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.department?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.team?.name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.manager?.name || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-primary" />
                {modal === "create" ? "Create User" : `Edit: ${modal.name}`}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="user-name">Name *</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-email">Email Address *</Label>
                <Input
                  type="email"
                  id="user-email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-pw">{modal === "create" ? "Password *" : "New Password (leave blank to keep)"}</Label>
                <Input
                  type="password"
                  id="user-pw"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={modal === "create"}
                />
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="user-role" className="mb-1">Role *</Label>
                <select
                  id="user-role"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value, manager: "" }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="employee" className="bg-card">Employee</option>
                  <option value="manager" className="bg-card">Manager</option>
                  <option value="super_admin" className="bg-card">Super Admin</option>
                </select>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="user-dept" className="mb-1">Department</Label>
                <select
                  id="user-dept"
                  value={form.department}
                  onChange={e => setForm(f => ({ ...f, department: e.target.value, team: "" }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card">— None —</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id} className="bg-card text-foreground">{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 flex flex-col">
                <Label htmlFor="user-team" className="mb-1">Team</Label>
                <select
                  id="user-team"
                  value={form.team}
                  onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card">— None —</option>
                  {filteredTeams.map(t => (
                    <option key={t._id} value={t._id} className="bg-card text-foreground">{t.name}</option>
                  ))}
                </select>
              </div>
              {form.role === "employee" && (
                <div className="space-y-2 flex flex-col">
                  <Label htmlFor="user-manager" className="mb-1">Manager</Label>
                  <select
                    id="user-manager"
                    value={form.manager}
                    onChange={e => setForm(f => ({ ...f, manager: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="" className="bg-card">— None —</option>
                    {managers.map(m => (
                      <option key={m._id} value={m._id} className="bg-card text-foreground">{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <DialogFooter className="pt-2">
                <Button type="button" variant="ghost" onClick={() => setModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
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
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Super Admin Control Center
        </h2>
        <p className="text-muted-foreground">
          Welcome, <strong>{user?.name}</strong>. Manage the organization structure, departments, teams, and members.
        </p>
      </div>

      <Tabs defaultValue="departments" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-[400px] grid-cols-3 bg-muted/60">
          <TabsTrigger value="departments" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-4 w-4" /> Teams
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
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
