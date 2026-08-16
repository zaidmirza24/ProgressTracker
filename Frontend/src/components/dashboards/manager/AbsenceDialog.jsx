import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CalendarOff, Trash2, Info } from "lucide-react"
import PersonAvatar from "@/components/ui/person-avatar"
import { getLocalDateString } from "../../../lib/taskFormatters"
import { useToast } from "../../../context/ToastContext"
import useCalendarStore from "../../../store/useCalendarStore"

// Record time away for a team member. Lives on the workload card because that's where
// a manager notices someone isn't available — not buried in an admin screen.
//
// Absence zeroes that person's capacity for the range (half day halves it) and stops
// daily tasks being generated for them, so weekends-off and leave stop distorting
// completion rates and backlog age.
const TYPE_OPTIONS = [
  { value: "leave", label: "Leave" },
  { value: "sick", label: "Sick" },
  { value: "holiday", label: "Personal holiday" },
  { value: "half_day", label: "Half day" }
]

const AbsenceDialog = ({ employee, open, onOpenChange }) => {
  const createAbsence = useCalendarStore(s => s.createAbsence)
  const deleteAbsence = useCalendarStore(s => s.deleteAbsence)
  const calendar = useCalendarStore(s => s.calendar)
  const saving = useCalendarStore(s => s.saving)
  const toast = useToast()

  const today = getLocalDateString()
  const [form, setForm] = useState({ startDate: today, endDate: today, type: "leave", reason: "" })

  if (!employee) return null

  // Existing absences for this person, from the context the capacity maths already uses.
  const existing = (calendar?.absences || [])
    .filter(a => String(a.employee?._id || a.employee) === String(employee._id))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))

  const isHalfDay = form.type === "half_day"

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.startDate || !form.endDate) {
      toast.error("Pick a start and end date.")
      return
    }
    if (new Date(form.endDate) < new Date(form.startDate)) {
      toast.error("The end date can't be before the start date.")
      return
    }
    const payload = {
      employee: employee._id,
      startDate: form.startDate,
      // A half day is by definition a single date.
      endDate: isHalfDay ? form.startDate : form.endDate,
      type: form.type,
      reason: form.reason.trim()
    }
    const result = await createAbsence(payload)
    if (result.success) {
      toast.success(`Recorded ${employee.name}'s time away.`)
      setForm({ startDate: today, endDate: today, type: "leave", reason: "" })
    } else if (result.code === "ABSENCE_OVERLAP") {
      // The global interceptor already showed the server message; nothing to add.
    }
  }

  const handleDelete = async (id) => {
    const result = await deleteAbsence(id)
    if (result.success) toast.success("Absence removed.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarOff className="h-4.5 w-4.5 text-primary" />
            Time away
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <PersonAvatar name={employee.name} seed={employee._id} fallback="EM" className="h-5 w-5 text-[9px]" />
            <span className="font-semibold text-foreground">{employee.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="absence-start" className="text-foreground/80 font-medium text-xs">From</Label>
              <Input
                id="absence-start"
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="h-9 rounded-lg text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="absence-end" className="text-foreground/80 font-medium text-xs">To</Label>
              <Input
                id="absence-end"
                type="date"
                value={isHalfDay ? form.startDate : form.endDate}
                disabled={isHalfDay}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="h-9 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground/80 font-medium text-xs">Type</Label>
            <Select value={form.type} onValueChange={val => setForm(f => ({ ...f, type: val }))}>
              <SelectTrigger className="h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="absence-reason" className="text-foreground/80 font-medium text-xs">Note (optional)</Label>
            <Input
              id="absence-reason"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Annual leave"
              className="h-9 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/20 border border-border/30 rounded-lg p-2.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {isHalfDay
                ? "A half day halves this person's capacity for that date. Daily tasks are still generated."
                : "Capacity is zero for these dates and no daily tasks are generated. Existing tasks are left alone."}
            </span>
          </div>

          <Button type="submit" disabled={saving} className="w-full rounded-lg h-9 font-semibold">
            {saving ? "Saving…" : "Record time away"}
          </Button>
        </form>

        {existing.length > 0 && (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recorded</h4>
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {existing.map(a => (
                <div key={a._id} className="flex items-center justify-between gap-2 text-xs bg-muted/15 border border-border/30 rounded-lg px-2.5 py-1.5">
                  <div className="min-w-0">
                    <span className="font-semibold text-foreground/90">
                      {new Date(a.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {new Date(a.startDate).getTime() !== new Date(a.endDate).getTime() &&
                        ` – ${new Date(a.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </span>
                    <Badge variant="outline" className="ml-1.5 text-[8px] py-0 px-1 uppercase font-bold">
                      {TYPE_OPTIONS.find(o => o.value === a.type)?.label || a.type}
                    </Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a._id)}
                    disabled={saving}
                    aria-label="Remove absence"
                    className="h-6 w-6 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" className="rounded-lg h-9" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AbsenceDialog
