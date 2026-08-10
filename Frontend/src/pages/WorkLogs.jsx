import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../lib/api"
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
import { Plus, FileText, Clock, ClipboardList, Loader2, Calendar, AlertCircle } from "lucide-react"

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
      const res = await axios.get(`${API_BASE}/api/daily-work-logs${params}`)
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
      const res = await axios.get(`${API_BASE}/api/users`)
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
    setPrefilling(true)
    try {
      const res = await axios.get(`${API_BASE}/api/work-sessions/today-hours`)
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
      await axios.post(`${API_BASE}/api/daily-work-logs`, form)
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
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
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
          <Button onClick={openCreate} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
            <Plus className="h-4.5 w-4.5" /> Submit Daily Log
          </Button>
        )}
      </div>

      {/* Manager filter */}
      {isManager && employees.length > 0 && (
        <div className="flex items-center gap-3 bg-muted/20 px-4 py-3 rounded-xl border border-border/40 w-fit">
          <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Filter Employee:</Label>
          <select
            value={filterEmployee}
            onChange={e => handleFilterChange(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="" className="bg-card text-foreground">— All Employees —</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id} className="bg-card text-foreground">{emp.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Logs Table */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold">
            {isEmployee ? "My Logs" : "Team Submissions"}
            <Badge variant="secondary" className="ml-2 rounded-full px-2 py-0.5 text-xs font-mono">
              {logs.length}
            </Badge>
          </CardTitle>
          <CardDescription>
            {isEmployee ? "Your daily productivity submissions" : "Daily work logs from team members"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  {isManager && <TableHead className="font-semibold text-foreground/80">Employee</TableHead>}
                  <TableHead className="font-semibold text-foreground/80">Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Today's Work Summary</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Hours Worked</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Next Day Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 5 : 4} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Loading logs...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isManager ? 5 : 4} className="text-center py-16">
                      <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground">No logs submitted</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {isEmployee 
                              ? "You haven't submitted any daily logs yet. Get started by clicking the submit button above." 
                              : "No team members have filed a log for the current filter."
                            }
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow
                      key={log._id}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setDetailLog(log)}
                    >
                      {isManager && (
                        <TableCell className="font-bold text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[9px] font-bold flex items-center justify-center">
                              {log.employee?.name ? log.employee.name[0].toUpperCase() : "E"}
                            </div>
                            <span>{log.employee?.name}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                          {new Date(log.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate text-sm text-foreground/80">{log.todaysWork}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs font-bold rounded-md bg-muted/40 whitespace-nowrap">
                          <Clock className="h-3 w-3 mr-1 text-primary" /> {log.hoursWorked}h
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <p className="truncate text-xs text-muted-foreground">{log.nextPlan || "—"}</p>
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
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-foreground">
              <ClipboardList className="h-5.5 w-5.5 text-primary" />
              Submit Daily Work Log
            </DialogTitle>
            <DialogDescription className="text-xs uppercase tracking-wider font-semibold text-primary">
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="log-work" className="text-foreground/80 font-medium">What did you work on today? *</Label>
              <Textarea
                id="log-work"
                rows={3}
                placeholder="Describe your main work items and accomplishments..."
                value={form.todaysWork}
                onChange={e => setForm(f => ({ ...f, todaysWork: e.target.value }))}
                className="rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="log-hours" className="flex items-center gap-1.5 text-foreground/80 font-medium">
                  <Clock className="h-3.5 w-3.5 text-primary" />
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
                  className="h-10 rounded-lg"
                  required
                />
                {!prefilling && form.hoursWorked > 0 && (
                  <p className="text-[10px] text-primary/80 italic font-medium">Pre-filled from today's timer sessions</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="log-tasks" className="text-foreground/80 font-medium">Tasks Completed</Label>
                <Input
                  id="log-tasks"
                  placeholder="e.g. AUTH-01, UI-03..."
                  value={form.tasksCompleted}
                  onChange={e => setForm(f => ({ ...f, tasksCompleted: e.target.value }))}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-problems" className="text-foreground/80 font-medium">Problems Faced</Label>
              <Textarea
                id="log-problems"
                rows={2}
                placeholder="Describe any blockers, bugs, or issues encountered..."
                value={form.problemsFaced}
                onChange={e => setForm(f => ({ ...f, problemsFaced: e.target.value }))}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-next" className="text-foreground/80 font-medium">Plan for Tomorrow</Label>
              <Textarea
                id="log-next"
                rows={2}
                placeholder="What do you plan to work on next?"
                value={form.nextPlan}
                onChange={e => setForm(f => ({ ...f, nextPlan: e.target.value }))}
                className="rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="log-remarks" className="text-foreground/80 font-medium">Additional Remarks</Label>
              <Input
                id="log-remarks"
                placeholder="Any additional notes for your manager..."
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg h-10 font-semibold shadow" disabled={submitting}>
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
          <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto border-border/60">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                Work Log Summary
              </DialogTitle>
              <DialogDescription className="text-xs uppercase tracking-wider font-semibold text-primary">
                {new Date(detailLog.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <Badge variant="outline" className="font-mono text-xs px-3 py-1 rounded-lg bg-muted/40">
                  <Clock className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  {detailLog.hoursWorked} hours worked
                </Badge>
                {detailLog.tasksCompleted && (
                  <Badge variant="secondary" className="text-xs px-3 py-1 rounded-lg">
                    Tasks: {detailLog.tasksCompleted}
                  </Badge>
                )}
                {isManager && (
                  <Badge variant="violet" className="text-xs px-3 py-1 rounded-lg">
                    By: {detailLog.employee?.name}
                  </Badge>
                )}
              </div>

              {[
                { label: "Today's Work Summary", value: detailLog.todaysWork },
                { label: "Problems Faced", value: detailLog.problemsFaced },
                { label: "Plan for Tomorrow", value: detailLog.nextPlan },
                { label: "Remarks", value: detailLog.remarks },
              ].map(({ label, value }) => value ? (
                <div key={label} className="space-y-1">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{label}</h4>
                  <p className="text-sm text-foreground bg-muted/20 p-3.5 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed">
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
