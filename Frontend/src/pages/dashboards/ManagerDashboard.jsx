import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "../../context/AuthContext"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  ClipboardList, CheckCircle2, Clock, BarChart3,
  Plus, MessageSquare, Send, Calendar, User, UserCheck, FileText
} from "lucide-react"

const STATUS_VARIANTS = {
  "Not Started": "secondary",
  "Accepted": "outline",
  "In Progress": "default",
  "Waiting for Review": "warning",
  "Completed": "success",
  "Approved": "success",
  "Rejected": "destructive",
  "Reopened": "info"
}

const PRIORITY_VARIANTS = {
  low: "outline",
  medium: "secondary",
  high: "destructive"
}

const ManagerDashboard = () => {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTask, setDetailTask] = useState(null)
  
  // Forms
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "General",
    department: "", assignedTo: "", priority: "medium",
    estimatedHours: 0, dueDate: ""
  })
  const [reviewComment, setReviewComment] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [workLogs, setWorkLogs] = useState([])
  const [logFilterEmployee, setLogFilterEmployee] = useState("")

  const loadData = async () => {
    try {
      const [tRes, uRes, dRes] = await Promise.all([
        axios.get("http://localhost:3000/api/tasks"),
        axios.get("http://localhost:3000/api/users"),
        axios.get("http://localhost:3000/api/departments")
      ])
      setTasks(tRes.data.tasks)
      // Filter employees that report to this manager
      const subordinates = uRes.data.users.filter(u => u.manager?._id === user.id || u.role === "employee")
      setEmployees(subordinates)
      setDepartments(dRes.data.departments)
      // Load today's work logs
      const logsRes = await axios.get("http://localhost:3000/api/daily-work-logs")
      setWorkLogs(logsRes.data.logs)
    } catch (err) {
      console.error("Error loading dashboard data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post("http://localhost:3000/api/tasks", taskForm)
      await loadData()
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        department: "", assignedTo: "", priority: "medium",
        estimatedHours: 0, dueDate: ""
      })
    } catch (err) {
      console.error("Error creating task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReview = async (status) => {
    if (!detailTask) return
    setSubmitting(true)
    try {
      const res = await axios.put(`http://localhost:3000/api/tasks/${detailTask._id}/status`, {
        status,
        comment: reviewComment
      })
      setDetailTask(res.data.task)
      setReviewComment("")
      await loadData()
    } catch (err) {
      console.error("Error submitting review:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePostComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim() || !detailTask) return
    try {
      const res = await axios.post(`http://localhost:3000/api/tasks/${detailTask._id}/comments`, {
        text: newComment
      })
      setDetailTask(res.data.task)
      setNewComment("")
      await loadData()
    } catch (err) {
      console.error("Error adding comment:", err)
    }
  }

  // Metrics
  const pendingReviewCount = tasks.filter(t => t.status === "Waiting for Review").length
  const inProgressCount = tasks.filter(t => t.status === "In Progress" || t.status === "Accepted").length
  const completedCount = tasks.filter(t => t.status === "Approved" || t.status === "Completed").length

  return (
    <div className="space-y-6">
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight">Manager Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, <strong>{user?.name}</strong>. Monitor team progress and review submissions.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create Task
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            <UserCheck className="h-4 w-4 text-yellow-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires approval review</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks actively tracked</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed / approved work items</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Team Tasks</CardTitle>
          <CardDescription>Overall tracking of work assigned to employees</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Assigned To</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Status</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No tasks assigned yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map(t => (
                    <TableRow
                      key={t._id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => setDetailTask(t)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <div>{t.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{t.category}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.assignedTo?.name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize">
                          {t.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[t.status] || "default"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground/90">
                        {t.progressPercentage}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Assign a task with estimation and priority metrics</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Build API login workflow"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc">Description</Label>
              <Textarea
                id="task-desc"
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Add task specification details..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-cat">Category</Label>
                <Input
                  id="task-cat"
                  value={taskForm.category}
                  onChange={e => setTaskForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Development"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-dept" className="mb-1">Department</Label>
                <select
                  id="task-dept"
                  value={taskForm.department}
                  onChange={e => setTaskForm(f => ({ ...f, department: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card">— None —</option>
                  {departments.map(d => (
                    <option key={d._id} value={d._id} className="bg-card text-foreground">{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-assignee" className="mb-1">Assigned To *</Label>
                <select
                  id="task-assignee"
                  value={taskForm.assignedTo}
                  onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="" className="bg-card">— Select —</option>
                  {employees.map(emp => (
                    <option key={emp._id} value={emp._id} className="bg-card text-foreground">{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-priority" className="mb-1">Priority</Label>
                <select
                  id="task-priority"
                  value={taskForm.priority}
                  onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="low" className="bg-card">Low</option>
                  <option value="medium" className="bg-card">Medium</option>
                  <option value="high" className="bg-card">High</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="task-hours">Estimated Hours</Label>
                <Input
                  type="number"
                  id="task-hours"
                  value={taskForm.estimatedHours}
                  onChange={e => setTaskForm(f => ({ ...f, estimatedHours: Number(e.target.value) }))}
                  min="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-due">Due Date</Label>
                <Input
                  type="date"
                  id="task-due"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating…" : "Assign Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail & Approval Modal */}
      <Dialog open={detailTask !== null} onOpenChange={() => setDetailTask(null)}>
        {detailTask && (
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <DialogTitle>{detailTask.title}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[detailTask.status] || "default"}>
                  {detailTask.status}
                </Badge>
              </div>
              <DialogDescription>{detailTask.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Task Details Info */}
              <div className="grid grid-cols-2 gap-3 text-sm border-y border-border/40 py-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>Assigned To: <strong>{detailTask.assignedTo?.name}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Due: <strong>{detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString() : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Est. Hours: <strong>{detailTask.estimatedHours} hrs</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BarChart3 className="h-4 w-4" />
                  <span>Progress: <strong>{detailTask.progressPercentage}%</strong></span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/30">
                  {detailTask.description || "No description provided."}
                </p>
              </div>

              {/* Approval Gating Controls */}
              {(detailTask.status === "Waiting for Review" || detailTask.status === "Completed") && (
                <div className="space-y-3 p-4 rounded-xl border border-warning/20 bg-warning/5">
                  <h4 className="text-sm font-semibold text-foreground">Task Review Panel</h4>
                  <div className="space-y-2">
                    <Label htmlFor="review-comm" className="text-xs">Review Feedback Comments</Label>
                    <Input
                      id="review-comm"
                      placeholder="Feedback details (required to approve/reject)..."
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReview("Rejected")}
                      disabled={submitting}
                    >
                      Reject Work
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReview("Approved")}
                      disabled={submitting}
                    >
                      Approve Work
                    </Button>
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({detailTask.comments.length})
                </h4>

                {/* Comment log stream */}
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {detailTask.comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-2">No comments logged yet.</p>
                  ) : (
                    detailTask.comments.map(c => (
                      <div key={c._id} className="text-xs bg-muted/40 p-2.5 rounded-lg border border-border/30 space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span className="text-foreground/90">{c.author?.name} ({c.author?.role})</span>
                          <span className="text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">{c.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Post comment form */}
                <form onSubmit={handlePostComment} className="flex gap-2">
                  <Input
                    placeholder="Write a message..."
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="flex-1 text-xs"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
      {/* Work Logs Section */}
      {(() => {
        const filteredLogs = logFilterEmployee
          ? workLogs.filter(l => l.employee?._id === logFilterEmployee)
          : workLogs
        return (
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Team Work Logs
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs ml-1">
                    {filteredLogs.length}
                  </Badge>
                </CardTitle>
                <CardDescription>Daily work log submissions from your team</CardDescription>
              </div>
              <select
                value={logFilterEmployee}
                onChange={e => setLogFilterEmployee(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">— All Members —</option>
                {employees.filter(e => e.role === "employee").map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name}</option>
                ))}
              </select>
            </CardHeader>
            <CardContent>
              <div className="border border-border/50 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground/80">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Date</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Summary</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Hours</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Next Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                          No work logs submitted yet.
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.slice(0, 10).map(log => (
                      <TableRow key={log._id} className="hover:bg-muted/30">
                        <TableCell className="font-medium">{log.employee?.name}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                          {new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm">{log.todaysWork}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">{log.hoursWorked}h</Badge>
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          <p className="truncate text-xs text-muted-foreground">{log.nextPlan || "—"}</p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      })()}

    </div>
  )
}

export default ManagerDashboard
