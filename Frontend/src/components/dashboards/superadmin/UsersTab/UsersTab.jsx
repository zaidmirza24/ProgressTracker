import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { UserPlus, Pencil, AlertCircle, Mail, Plus, UserMinus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import PersonAvatar from "@/components/ui/person-avatar"
import useOrgStore from "../../../../store/useOrgStore"
import OnboardingWizard from "./OnboardingWizard"
import DeactivateUserDialog from "./DeactivateUserDialog"
import { useAuth } from "../../../../context/AuthContext"
import { ROLE_VARIANTS, ROLE_LABELS } from "./roleConstants"

const UsersTab = () => {
  const { user: currentUser } = useAuth()
  const currentUserId = currentUser?.id || currentUser?._id
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  // Open-task count drives whether a handover is required. Fetched lazily on open so
  // the table itself doesn't pull the whole task list.
  const [openTaskCount, setOpenTaskCount] = useState(0)

  const requestDeactivate = async (u) => {
    setOpenTaskCount(0)
    setDeactivateTarget(u)
    try {
      const res = await axios.get(`${API_BASE}/api/tasks?scope=all&assignedTo=${u._id}`)
      // Daily tasks are handled automatically on deactivation; only assigned work
      // needs a human to pick a new owner.
      setOpenTaskCount(res.data.tasks.filter(t => t.status !== "Completed" && !t.isDaily).length)
    } catch {
      // Leave at 0 — the server still refuses if a handover turns out to be needed.
    }
  }

  const users = useOrgStore(s => s.users)
  const departments = useOrgStore(s => s.departments)
  const teams = useOrgStore(s => s.teams)
  const loading = useOrgStore(s => s.usersLoading)
  const fetchUsers = useOrgStore(s => s.fetchUsers)
  const updateUser = useOrgStore(s => s.updateUser)

  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "employee",
    department: "", team: "", manager: "",
    dailyWorkingHours: 8, breakHours: 1
  })

  useEffect(() => { fetchUsers() }, [])

  const openCreate = () => {
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
      manager: u.manager?._id || "",
      dailyWorkingHours: u.dailyWorkingHours ?? 8,
      breakHours: u.breakHours ?? 1
    })
    setModal(u)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    if (!payload.password) {
      delete payload.password
    }

    try {
      await updateUser(modal._id, payload)
      setModal(null)
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
    <>
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
                  return (
                    <TableRow key={u._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-semibold text-sm">
                        <div className="flex items-center gap-2">
                          <PersonAvatar name={u.name} seed={u._id} fallback="US" className="h-6 w-6 text-[9px]" />
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
                        {/* Self-deactivation is refused server-side too */}
                        {u._id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => requestDeactivate(u)}
                            title={`Deactivate ${u.name}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
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
          <DialogContent className="sm:max-w-[480px] border-border/60">
            {modal === "create" ? (
              // ── Onboarding Wizard (Create Mode) ──
              <OnboardingWizard onClose={() => setModal(null)} />
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
                              return (
                                <SelectItem key={m._id} value={m._id}>
                                  <span className="flex items-center gap-2">
                                    <PersonAvatar name={m.name} seed={m._id} fallback="M" className="h-4 w-4 text-[8px]" />
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
                  {form.role === "employee" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="user-working-hours" className="text-foreground/80 font-medium">Daily Working Hours</Label>
                        <Input
                          type="number"
                          id="user-working-hours"
                          value={form.dailyWorkingHours}
                          onChange={e => setForm(f => ({ ...f, dailyWorkingHours: Number(e.target.value) }))}
                          min="0"
                          className="h-10 rounded-lg"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="user-break-hours" className="text-foreground/80 font-medium">Break Hours</Label>
                        <Input
                          type="number"
                          id="user-break-hours"
                          value={form.breakHours}
                          onChange={e => setForm(f => ({ ...f, breakHours: Number(e.target.value) }))}
                          min="0"
                          className="h-10 rounded-lg"
                        />
                      </div>
                    </div>
                  )}
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

      <DeactivateUserDialog
        key={deactivateTarget?._id}
        user={deactivateTarget}
        open={deactivateTarget !== null}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null) }}
        openTaskCount={openTaskCount}
      />
    </>
  )
}

export default UsersTab
