import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Repeat, Plus, Pencil, Trash2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import useTaskTemplatesStore from "../../../store/useTaskTemplatesStore"

const TaskTemplatesTab = () => {
  const templates = useTaskTemplatesStore(s => s.templates)
  const departments = useTaskTemplatesStore(s => s.departments)
  const loading = useTaskTemplatesStore(s => s.loading)
  const fetchTemplates = useTaskTemplatesStore(s => s.fetchTemplates)
  const createTemplate = useTaskTemplatesStore(s => s.createTemplate)
  const updateTemplate = useTaskTemplatesStore(s => s.updateTemplate)
  const deleteTemplate = useTaskTemplatesStore(s => s.deleteTemplate)

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

  useEffect(() => { fetchTemplates() }, [])

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

export default TaskTemplatesTab
