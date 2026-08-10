import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../context/AuthContext"
import { motion } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, FileText, Clock, ClipboardList, Loader2 } from "lucide-react"

const BLANK_FORM = {
  todaysWork: "",
  hoursWorked: "",
  tasksCompleted: "",
  problemsFaced: "",
  nextPlan: "",
  remarks: ""
}

const WorkLogs = () => {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [prefilling, setPrefilling] = useState(false)
  const [detailLog, setDetailLog] = useState(null)

  const isManager = user?.role === "manager" || user?.role === "super_admin"
  const isEmployee = user?.role === "employee"

  // For manager view — employee filter
  const [employees, setEmployees] = useState([])
  const [filterEmployee, setFilterEmployee] = useState("")

  const loadLogs = async (empFilter = "") => {
    try {
      const params = empFilter ? `?employee=${empFilter}` : ""
      const res = await axios.get(`http://localhost:3000/api/daily-work-logs${params}`)
      setLogs(res.data.logs)
    } catch (err) {
      console.error("Error loading logs:", err)
    } finally {
      setLoading(false)
    }
  }

  const loadEmployees = async () => {
    if (!isManager) return
    try {
      const res = await axios.get("http://localhost:3000/api/users")
      const subordinates = res.data.users.filter(u => u.role === "employee")
      setEmployees(subordinates)
    } catch (err) {
      console.error("Error loading employees:", err)
    }
  }

  useEffect(() => {
    loadLogs()
    loadEmployees()
  }, [])

  const handleFilterChange = async (empId) => {
    setFilterEmployee(empId)
    setLoading(true)
    await loadLogs(empId)
  }

  const openCreate = async () => {
    setForm(BLANK_FORM)
    setCreateOpen(true)
    // Pre-fill hours from today's sessions
    setPrefilling(true)
    try {
      const res = await axios.get("http://localhost:3000/api/work-sessions/today-hours")
      setForm(f => ({ ...f, hoursWorked: res.data.hoursWorked }))
    } catch {
      // Leave blank if fetch fails
    } finally {
      setPrefilling(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post("http://localhost:3000/api/daily-work-logs", form)
      await loadLogs()
      setCreateOpen(false)
      setForm(BLANK_FORM)
    } catch (err) {
      console.error("Error submitting log:", err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Daily Work Logs
          </h2>
          <p className="text-muted-foreground">
            {isEmployee
              ? "Submit your daily update and track your productivity journal."
              : "Review work logs submitted by your team members."}
          </p>
        </div>
        {isEmployee && (
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> Submit Daily Log
          </Button>
        )}
      </div>

      {/* Manager filter */}
      {isManager && employees.length > 0 && (
        <div className="flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">Filter by Employee:</Label>
          <select
            value={filterEmployee}
            onChange={e => handleFilterChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">— All Employees —</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Logs Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>
            {isEmployee ? "My Logs" : "Team Submissions"}
            <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0.5 text-xs">
              {logs.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            {isEmployee ? "Your daily productivity submissions" : "Daily work logs from team members"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  {isManager && <TableHead className="font-semibold text-foreground/80">Employee</TableHead>}
                  <TableHead className="font-semibold text-foreground/80">Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Today's Work</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Hours</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Next Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground">
                      Loading logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground">
                      {isEmployee ? "No logs submitted yet. Submit your first daily log!" : "No logs submitted by team members yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow
                      key={log._id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetailLog(log)}
                    >
                      {isManager && (
                        <TableCell className="font-medium">{log.employee?.name}</TableCell>
                      )}
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {new Date(log.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </TableCell>
                      <TableCell className="max-w-[240px]">
                        <p className="truncate text-sm">{log.todaysWork}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {log.hoursWorked}h
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-sm text-muted-foreground">{log.nextPlan || "—"}</p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Submit Daily Log Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Submit Daily Work Log
            </DialogTitle>
            <DialogDescription>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-work">What did you work on today? *</Label>
              <Textarea
                id="log-work"
                rows={3}
                placeholder="Describe your main work items and accomplishments..."
                value={form.todaysWork}
                onChange={e => setForm(f => ({ ...f, todaysWork: e.target.value }))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="log-hours" className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Hours Worked *
                  {prefilling && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </Label>
                <Input
                  id="log-hours"
                  type="number"
                  step="0.01"
                  min="0"
                  max="24"
                  placeholder="0.00"
                  value={form.hoursWorked}
                  onChange={e => setForm(f => ({ ...f, hoursWorked: e.target.value }))}
                  required
                />
                {!prefilling && form.hoursWorked > 0 && (
                  <p className="text-[11px] text-muted-foreground">Pre-filled from today's timer sessions</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="log-tasks">Tasks Completed</Label>
                <Input
                  id="log-tasks"
                  placeholder="e.g. AUTH-01, UI-03..."
                  value={form.tasksCompleted}
                  onChange={e => setForm(f => ({ ...f, tasksCompleted: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-problems">Problems Faced</Label>
              <Textarea
                id="log-problems"
                rows={2}
                placeholder="Describe any blockers, bugs, or issues encountered..."
                value={form.problemsFaced}
                onChange={e => setForm(f => ({ ...f, problemsFaced: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-next">Plan for Tomorrow</Label>
              <Textarea
                id="log-next"
                rows={2}
                placeholder="What do you plan to work on next?"
                value={form.nextPlan}
                onChange={e => setForm(f => ({ ...f, nextPlan: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-remarks">Additional Remarks</Label>
              <Input
                id="log-remarks"
                placeholder="Any additional notes for your manager..."
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : "Submit Log"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Log Detail Dialog */}
      <Dialog open={detailLog !== null} onOpenChange={() => setDetailLog(null)}>
        {detailLog && (
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Work Log — {new Date(detailLog.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </DialogTitle>
              <DialogDescription>
                {isManager ? `Submitted by ${detailLog.employee?.name}` : "Your daily work summary"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-sm px-3 py-1">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  {detailLog.hoursWorked} hours worked
                </Badge>
                {detailLog.tasksCompleted && (
                  <Badge variant="secondary" className="text-xs">
                    Tasks: {detailLog.tasksCompleted}
                  </Badge>
                )}
              </div>

              {[
                { label: "Today's Work", value: detailLog.todaysWork },
                { label: "Problems Faced", value: detailLog.problemsFaced },
                { label: "Plan for Tomorrow", value: detailLog.nextPlan },
                { label: "Remarks", value: detailLog.remarks },
              ].map(({ label, value }) => value ? (
                <div key={label} className="space-y-1.5">
                  <h4 className="text-sm font-semibold text-foreground/80">{label}</h4>
                  <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30 whitespace-pre-wrap">
                    {value}
                  </p>
                </div>
              ) : null)}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

export default WorkLogs
