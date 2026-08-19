import { useState } from "react"
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import useOrgStore from "../../../../store/useOrgStore"
import { ROLE_LABELS } from "./roleConstants"

const OnboardingWizard = ({ onClose }) => {
  const departments = useOrgStore(s => s.departments)
  const teams = useOrgStore(s => s.teams)
  const users = useOrgStore(s => s.users)
  const createDepartmentInline = useOrgStore(s => s.createDepartmentInline)
  const createTeamInline = useOrgStore(s => s.createTeamInline)
  const createUser = useOrgStore(s => s.createUser)

  const [saving, setSaving] = useState(false)
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
      const newDeptId = await createDepartmentInline(newDeptName.trim())
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
      const newTeamId = await createTeamInline(newTeamName.trim(), form.department)
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

  const handleSubmit = async () => {
    setSaving(true)
    const payload = { ...form }

    try {
      const user = await createUser(payload)
      setOnboardedUser({ ...user, rawPassword: form.password })
      setOnboardingStep(4) // Move to completion step
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

  return (
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
            <Button type="button" variant="ghost" className="rounded-lg h-9 text-xs" onClick={onClose}>Cancel</Button>
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
          <Button type="button" className="w-full rounded-lg h-10 font-bold shadow bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onClose}>
            Finish & Close
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

export default OnboardingWizard
