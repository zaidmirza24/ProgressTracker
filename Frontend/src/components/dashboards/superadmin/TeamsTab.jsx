import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Users, Pencil, AlertCircle, Plus } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useOrgStore from "../../../store/useOrgStore"

const TeamsTab = () => {
  const teams = useOrgStore(s => s.teams)
  const departments = useOrgStore(s => s.departments)
  const loading = useOrgStore(s => s.teamsLoading)
  const fetchTeams = useOrgStore(s => s.fetchTeams)
  const createTeam = useOrgStore(s => s.createTeam)
  const updateTeam = useOrgStore(s => s.updateTeam)

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: "", department: "" })
  const [saving, setSaving] = useState(false)

  // Load once on mount. `fetchTeams` is a zustand action with a stable identity,
  // so listing it as a dependency would be noise, not safety.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTeams() }, [])

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
        await createTeam(form)
      } else {
        await updateTeam(modal._id, form)
      }
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

export default TeamsTab
