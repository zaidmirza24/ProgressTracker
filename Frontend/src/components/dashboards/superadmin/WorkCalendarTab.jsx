import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarDays, Plus, Trash2, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { useToast } from "../../../context/ToastContext"
import useCalendarStore from "../../../store/useCalendarStore"

// Admin: which days the office works, and which dates it doesn't.
//
// This is the input to every capacity number in the product — before it existed,
// capacity assumed a 7-day week, so weekends quietly dragged down completion rates and
// inflated pending backlogs. Kept deliberately plain: seven checkboxes and a list.
const DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
  { value: 0, label: "Sunday", short: "Sun" }
]

// Outer shell owns fetching and the loading/error states. The editor below is only
// mounted once the calendar exists, so it can initialise its edit state straight from
// props — no seeding effect, and no "setState inside an effect" cascade.
const WorkCalendarTab = () => {
  const calendar = useCalendarStore(s => s.calendar)
  const loading = useCalendarStore(s => s.loading)
  const error = useCalendarStore(s => s.error)
  const fetchContext = useCalendarStore(s => s.fetchContext)

  useEffect(() => {
    if (!calendar) fetchContext()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error && !calendar) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-semibold text-foreground">Couldn't load the work calendar</p>
            <p className="text-sm text-muted-foreground">Capacity is being calculated as if every day is a working day until this loads.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchContext}>Retry</Button>
        </CardContent>
      </Card>
    )
  }

  if (loading || !calendar) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl w-full" />
        <Skeleton className="h-64 rounded-xl w-full" />
      </div>
    )
  }

  // Remount (and so re-seed) whenever the saved calendar changes.
  return <WorkCalendarEditor key={calendar.updatedAt || "calendar"} calendar={calendar} />
}

const WorkCalendarEditor = ({ calendar }) => {
  const saving = useCalendarStore(s => s.saving)
  const updateSettings = useCalendarStore(s => s.updateSettings)
  const toast = useToast()

  // Initialised directly from props — this component only exists once the data does.
  const [workingDays, setWorkingDays] = useState(calendar.workingDays || [1, 2, 3, 4, 5])
  const [holidays, setHolidays] = useState(
    (calendar.holidays || []).map(h => ({
      date: new Date(h.date).toISOString().split("T")[0],
      name: h.name
    }))
  )
  const [newHoliday, setNewHoliday] = useState({ date: "", name: "" })

  const toggleDay = (value) => {
    setWorkingDays(prev => prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value].sort())
  }

  const addHoliday = () => {
    if (!newHoliday.date || !newHoliday.name.trim()) {
      toast.error("A holiday needs both a date and a name.")
      return
    }
    if (holidays.some(h => h.date === newHoliday.date)) {
      toast.error("There's already a holiday on that date.")
      return
    }
    setHolidays(prev => [...prev, { date: newHoliday.date, name: newHoliday.name.trim() }]
      .sort((a, b) => a.date.localeCompare(b.date)))
    setNewHoliday({ date: "", name: "" })
  }

  const removeHoliday = (date) => setHolidays(prev => prev.filter(h => h.date !== date))

  const handleSave = async () => {
    if (workingDays.length === 0) {
      toast.error("Select at least one working day.")
      return
    }
    const result = await updateSettings({ workingDays, holidays })
    if (result.success) toast.success("Work calendar saved.")
  }

  // Only offer Save when something actually differs from what's stored.
  const originalDays = (calendar.workingDays || []).join(",")
  const originalHolidays = (calendar.holidays || [])
    .map(h => `${new Date(h.date).toISOString().split("T")[0]}:${h.name}`).sort().join("|")
  const currentHolidays = holidays.map(h => `${h.date}:${h.name}`).sort().join("|")
  const isDirty = workingDays.join(",") !== originalDays || currentHolidays !== originalHolidays

  const today = new Date()
  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date(today.toDateString()))

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-info/25 bg-info/5">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          These settings drive every capacity and workload number in the app. On a non-working day
          no daily tasks are generated, capacity is zero, and utilisation shows as “—” rather than 0%.
        </p>
      </div>

      {/* Working days */}
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <CalendarDays className="h-5 w-5 text-primary" />
            Working Days
          </CardTitle>
          <CardDescription>Which days of the week the office works.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DAYS.map(day => {
              const active = workingDays.includes(day.value)
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={active}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/40 bg-muted/20 text-muted-foreground hover:border-border"
                  }`}
                >
                  {active && <CheckCircle2 className="h-3 w-3" />}
                  {day.label}
                </button>
              )
            })}
          </div>
          {workingDays.length === 0 && (
            <p className="text-xs text-destructive font-semibold mt-3 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> At least one working day is required.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card className="border-border/40 shadow-lg bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            Holidays
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs font-mono">
              {upcomingHolidays.length} upcoming
            </Badge>
          </CardTitle>
          <CardDescription>Dates the whole office is off. Treated exactly like a non-working day.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="holiday-date" className="text-foreground/80 font-medium text-xs">Date</Label>
              <Input
                id="holiday-date"
                type="date"
                value={newHoliday.date}
                onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))}
                className="h-10 rounded-lg w-full sm:w-44"
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="holiday-name" className="text-foreground/80 font-medium text-xs">Name</Label>
              <Input
                id="holiday-name"
                value={newHoliday.name}
                onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))}
                placeholder="e.g. Diwali"
                className="h-10 rounded-lg"
              />
            </div>
            <Button type="button" variant="outline" onClick={addHoliday} className="h-10 rounded-lg gap-1.5 font-semibold">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>

          {holidays.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border/30 rounded-xl bg-muted/5">
              <p className="text-sm font-semibold text-foreground">No holidays set</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add public holidays and office closures so they don't count against anyone's capacity.
              </p>
            </div>
          ) : (
            <div className="border border-border/40 rounded-xl divide-y divide-border/30 overflow-hidden">
              {holidays.map(h => {
                const past = new Date(h.date) < new Date(today.toDateString())
                return (
                  <div key={h.date} className={`flex items-center justify-between px-3.5 py-2.5 ${past ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono font-bold text-muted-foreground shrink-0 w-24">
                        {new Date(h.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="text-sm font-semibold text-foreground/90 truncate">{h.name}</span>
                      {past && <Badge variant="outline" className="text-[9px] py-0 px-1 uppercase shrink-0">Past</Badge>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeHoliday(h.date)}
                      aria-label={`Remove ${h.name}`}
                      className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {isDirty && <span className="text-xs text-muted-foreground font-medium">Unsaved changes</span>}
        <Button
          onClick={handleSave}
          disabled={saving || !isDirty || workingDays.length === 0}
          className="rounded-lg font-semibold shadow"
        >
          {saving ? "Saving…" : "Save Calendar"}
        </Button>
      </div>
    </div>
  )
}

export default WorkCalendarTab
