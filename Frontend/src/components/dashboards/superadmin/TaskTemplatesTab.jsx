import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Repeat, Plus, Pencil, Trash2, Search, X, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import useTaskTemplatesStore from "../../../store/useTaskTemplatesStore"
import { useToast } from "../../../context/ToastContext"
import PersonAvatar from "@/components/ui/person-avatar"
import { PrioritySelect } from "../../tasks/TaskFormFields"

// Searchable, filterable multi-select for hand-picking individual employees on an
// "employees"-scoped template. Selected people surface as removable chips up top so
// the admin can see exactly who's targeted without scrolling the list.
const EmployeePicker = ({ employees, departments, selected, onChange }) => {
  const [search, setSearch] = useState("")
  const [deptFilter, setDeptFilter] = useState("all")

  const filtered = employees.filter(e => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    const matchesDept = deptFilter === "all" || e.department?._id === deptFilter
    return matchesSearch && matchesDept
  })

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])
  }

  const selectAllShown = () => {
    onChange(Array.from(new Set([...selected, ...filtered.map(e => e._id)])))
  }

  const clearShown = () => {
    const shownIds = new Set(filtered.map(e => e._id))
    onChange(selected.filter(id => !shownIds.has(id)))
  }

  const selectedEmployees = employees.filter(e => selected.includes(e._id))

  return (
    <div className="space-y-2">
      {selectedEmployees.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2">
          {selectedEmployees.map(e => (
            <span
              key={e._id}
              className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-[11px] font-semibold pl-2 pr-1 py-0.5"
            >
              {e.name}
              <button
                type="button"
                onClick={() => toggle(e._id)}
                className="rounded-full hover:bg-primary/25 p-0.5"
                aria-label={`Remove ${e.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search employees by name or email..."
          className="pl-8 h-9 text-xs"
        />
      </div>

      {departments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDeptFilter("all")}
            className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border transition-colors ${
              deptFilter === "all"
                ? "bg-primary/15 border-primary/40 text-primary"
                : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            All
          </button>
          {departments.map(d => (
            <button
              key={d._id}
              type="button"
              onClick={() => setDeptFilter(d._id)}
              className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full border transition-colors ${
                deptFilter === d._id
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">{selected.length} selected</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAllShown} className="text-[10px] font-bold uppercase text-primary hover:underline">
            Select shown
          </button>
          <button type="button" onClick={clearShown} className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive hover:underline">
            Clear shown
          </button>
        </div>
      </div>

      <div className="border border-border/40 rounded-lg max-h-48 overflow-y-auto bg-background/25 divide-y divide-border/30">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">No employees match your search.</div>
        ) : (
          filtered.map(e => {
            const isChecked = selected.includes(e._id)
            return (
              <label
                key={e._id}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors ${isChecked ? "bg-primary/5" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(e._id)}
                  className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 bg-transparent shrink-0"
                />
                <PersonAvatar name={e.name} seed={e._id} fallback="EM" className="h-7 w-7 text-[10px]" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground/90 truncate">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground truncate">{e.department?.name || "No department"}</span>
                </div>
              </label>
            )
          })
        )}
      </div>
    </div>
  )
}

const TaskTemplatesTab = () => {
  const templates = useTaskTemplatesStore(s => s.templates)
  const departments = useTaskTemplatesStore(s => s.departments)
  const employees = useTaskTemplatesStore(s => s.employees)
  const loading = useTaskTemplatesStore(s => s.loading)
  const fetchTemplates = useTaskTemplatesStore(s => s.fetchTemplates)
  const createTemplate = useTaskTemplatesStore(s => s.createTemplate)
  const updateTemplate = useTaskTemplatesStore(s => s.updateTemplate)
  const deleteTemplate = useTaskTemplatesStore(s => s.deleteTemplate)
  const toast = useToast()

  const [modal, setModal] = useState(null) // null | "create" | template object
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Daily",
    priority: "medium",
    estimatedHours: 1,
    scope: "global",
    departments: [],
    employees: []
  })
  const [saving, setSaving] = useState(false)

  // Load once on mount. `fetchTemplates` is a zustand action with a stable identity,
  // so listing it as a dependency would be noise, not safety.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchTemplates() }, [])

  const openCreate = () => {
    setForm({
      title: "",
      description: "",
      category: "Daily",
      priority: "medium",
      estimatedHours: 1,
      scope: "global",
      departments: [],
      employees: []
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
      departments: tpl.departments?.map(d => d._id) || [],
      employees: tpl.employees?.map(e => e._id) || []
    })
    setModal(tpl)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.scope === "department" && form.departments.length === 0) {
      toast.error("Please select at least one department.")
      return
    }
    if (form.scope === "employees" && form.employees.length === 0) {
      toast.error("Please select at least one employee.")
      return
    }
    setSaving(true)
    try {
      if (modal === "create") {
        await createTemplate(form)
      } else {
        await updateTemplate(modal._id, form)
      }
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
      await deleteTemplate(id)
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
                Click "Add Template" to configure recurring tasks for everyone, a department, or hand-picked employees.
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
                    <div>Scope: <span className="text-foreground font-bold">{t.scope === "employees" ? "employees" : t.scope}</span></div>
                    {t.scope === "department" && (
                      <div className="text-violet-400">Depts: <span className="font-bold text-violet-400">{t.departments?.map(d => d.name).join(", ") || "—"}</span></div>
                    )}
                    {t.scope === "employees" && (
                      <div className="text-violet-400 w-full flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        <span className="font-bold text-violet-400 normal-case tracking-normal">
                          {t.employees?.slice(0, 3).map(e => e.name).join(", ") || "—"}
                          {t.employees?.length > 3 && ` +${t.employees.length - 3} more`}
                        </span>
                      </div>
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
          <DialogContent className="max-w-md bg-card/95 backdrop-blur shadow-2xl border-border/50 max-h-[90vh] overflow-y-auto">
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
                <PrioritySelect
                  priority={form.priority}
                  onChange={value => setForm(f => ({ ...f, priority: value }))}
                  idPrefix="template"
                />
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
                  <Select
                    value={form.scope}
                    onValueChange={value => setForm(f => ({ ...f, scope: value }))}
                  >
                    <SelectTrigger className="h-10 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (All Employees)</SelectItem>
                      <SelectItem value="department">Department Specific</SelectItem>
                      <SelectItem value="employees">Specific Employees</SelectItem>
                    </SelectContent>
                  </Select>
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

              {form.scope === "employees" && (
                <div className="space-y-1.5">
                  <Label className="text-foreground/80 font-medium">Target Employees *</Label>
                  <EmployeePicker
                    employees={employees}
                    departments={departments}
                    selected={form.employees}
                    onChange={ids => setForm(f => ({ ...f, employees: ids }))}
                  />
                  {form.employees.length === 0 && (
                    <p className="text-[10px] text-destructive font-medium">* Select at least one employee</p>
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

export default TaskTemplatesTab
