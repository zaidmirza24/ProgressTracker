import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import { motion, AnimatePresence } from "motion/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ClipboardList, CheckCircle2, Clock, BarChart3,
  Plus, MessageSquare, Send, Calendar, User, UserCheck, FileText, AlertCircle, Check
} from "lucide-react"

const STATUS_VARIANTS = {
  "Not Started": "secondary",
  "Accepted": "outline",
  "In Progress": "violet",
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

const CATEGORY_PRESETS = [
  "Development",
  "Design",
  "QA / Testing",
  "Bug Fix",
  "Documentation",
  "DevOps / Infra",
  "Research",
  "In-Office Work",
  "Client Meeting",
  "Admin / HR"
]

const getLocalDateString = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
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
    estimatedHours: 0, dueDate: getLocalDateString()
  })
  const [customCategoryActive, setCustomCategoryActive] = useState(false)
  const [reviewComment, setReviewComment] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [workLogs, setWorkLogs] = useState([])
  const [logFilterEmployee, setLogFilterEmployee] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = searchQuery
      ? (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.priority?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.assignedTo?.name?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    return matchesSearch
  })
  const [inlineRejectId, setInlineRejectId] = useState(null)
  const [inlineRejectComment, setInlineRejectComment] = useState("")
  const [showAdvancedTaskForm, setShowAdvancedTaskForm] = useState(false)

  const handleInlineApprove = async (taskId) => {
    setSubmitting(true)
    try {
      await axios.put(`${API_BASE}/api/tasks/${taskId}/status`, {
        status: "Approved",
        comment: "Approved by manager."
      })
      await loadData()
    } catch (err) {
      console.error("Error approving task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleInlineReject = async (taskId) => {
    if (!inlineRejectComment.trim()) return
    setSubmitting(true)
    try {
      await axios.put(`${API_BASE}/api/tasks/${taskId}/status`, {
        status: "Rejected",
        comment: inlineRejectComment
      })
      setInlineRejectId(null)
      setInlineRejectComment("")
      await loadData()
    } catch (err) {
      console.error("Error rejecting task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const loadData = async () => {
    try {
      const [tRes, uRes, dRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks`),
        axios.get(`${API_BASE}/api/users`),
        axios.get(`${API_BASE}/api/departments`)
      ])
      setTasks(tRes.data.tasks)
      // Filter employees that report to this manager
      const managerId = user?.id || user?._id
      const subordinates = uRes.data.users.filter(u => u.manager?._id === managerId)
      setEmployees(subordinates)
      setDepartments(dRes.data.departments)
      // Load today's work logs
      const logsRes = await axios.get(`${API_BASE}/api/daily-work-logs`)
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
    if (!taskForm.assignedTo) return
    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadData()
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        department: "", assignedTo: "", priority: "medium",
        estimatedHours: 0, dueDate: getLocalDateString()
      })
      setCustomCategoryActive(false)
    } catch (err) {
      console.error("Error creating task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const openCreateForEmployee = (employeeId) => {
    setTaskForm({
      title: "", description: "", category: "General",
      department: "", assignedTo: employeeId, priority: "medium",
      estimatedHours: 0, dueDate: getLocalDateString()
    })
    setCustomCategoryActive(false)
    setCreateOpen(true)
  }

  const handleReview = async (status, feedbackOverride = "") => {
    if (!detailTask) return
    setSubmitting(true)
    try {
      const res = await axios.put(`${API_BASE}/api/tasks/${detailTask._id}/status`, {
        status,
        comment: feedbackOverride || reviewComment
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
      const res = await axios.post(`${API_BASE}/api/tasks/${detailTask._id}/comments`, {
        text: newComment
      })
      setDetailTask(res.data.task)
      setNewComment("")
      await loadData()
    } catch (err) {
      console.error("Error adding comment:", err)
    }
  }

  const formatTrackedTime = (seconds) => {
    if (!seconds) return "0m"
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0) {
      return `${hrs}h ${mins}m`
    }
    return `${mins}m`
  }

  // Get available transitions for manager inline dropdown
  const getNextStatusesForManager = (task) => {
    switch (task.status) {
      case "Waiting for Review": return ["Approved", "Rejected"]
      case "Not Started": return ["Accepted", "In Progress"]
      case "Accepted": return ["In Progress"]
      case "In Progress": return ["Waiting for Review"]
      case "Rejected": return ["In Progress"]
      case "Reopened": return ["In Progress"]
      case "Approved": return ["Reopened"] // Allow manager to reopen approved task
      case "Completed": return ["In Progress"] // Allow reopening self-assigned completed task
      default: return []
    }
  }

  // Visual Stepper steps configuration
  const getStepperSteps = (task) => {
    const isSelfCreated = task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo
    if (isSelfCreated) {
      return [
        { label: "Not Started", key: "Not Started" },
        { label: "Accepted", key: "Accepted" },
        { label: "In Progress", key: "In Progress" },
        { label: "Completed", key: "Completed" }
      ]
    } else {
      return [
        { label: "Not Started", key: "Not Started" },
        { label: "Accepted", key: "Accepted" },
        { label: "In Progress", key: "In Progress" },
        { label: "In Review", key: "Waiting for Review" },
        { label: "Approved", key: "Approved" }
      ]
    }
  }

  // Metrics
  const pendingReviewCount = tasks.filter(t => t.status === "Waiting for Review").length
  const inProgressCount = tasks.filter(t => ["In Progress", "Accepted"].includes(t.status)).length
  const completedCount = tasks.filter(t => ["Approved", "Completed"].includes(t.status)).length

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-10 w-32 self-start sm:self-auto" />
        </div>

        {/* Metric cards skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-border/50 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table skeleton */}
        <Card className="border-border/50">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-6 gap-4 pb-2 border-b border-border/50">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-3" />)}
              </div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="grid grid-cols-6 gap-4 py-2">
                  {[...Array(6)].map((_, j) => <Skeleton key={j} className="h-4" />)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Manager Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{user?.name}</strong>. Monitor team progress, assign tasks, and review submissions.
          </p>
        </div>
        <Button onClick={() => { setCreateOpen(true); setCustomCategoryActive(false); }} className="gap-2 font-semibold shadow-md glow-primary self-start sm:self-auto">
          <Plus className="h-4.5 w-4.5" /> Create Task
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team Tasks</CardTitle>
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total assigned tasks</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-warning rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Review</CardTitle>
            <UserCheck className={`h-4.5 w-4.5 ${pendingReviewCount > 0 ? "text-warning animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight text-warning-foreground">{pendingReviewCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires approval review</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In Progress</CardTitle>
            <Clock className="h-4.5 w-4.5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{inProgressCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Tasks actively tracked</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approved Tasks</CardTitle>
            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed / approved work items</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Review Queue */}
      {(() => {
        const reviewTasks = tasks.filter(t => t.status === "Waiting for Review")
        if (reviewTasks.length === 0) return null

        return (
          <div className="space-y-4">
            <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-warning" />
              Pending Review Queue ({reviewTasks.length})
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              {reviewTasks.map(t => {
                const authorInitials = t.assignedTo?.name ? t.assignedTo.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "EM"
                const lastComment = t.comments && t.comments.length > 0 ? t.comments[t.comments.length - 1].text : "No notes provided."
                return (
                  <Card key={t._id} className="border-warning/30 bg-card/45 backdrop-blur-sm shadow-md overflow-hidden relative border-l-4 border-l-warning">
                    <CardHeader className="pb-2 flex flex-row items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">{t.category}</span>
                        <CardTitle className="text-sm font-bold text-foreground mt-0.5 leading-snug">{t.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                          <User className="h-3 w-3" /> Submitted by <strong className="text-foreground">{t.assignedTo?.name}</strong>
                        </p>
                      </div>
                      {t.totalTrackedSeconds > 0 && (
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0 border-violet-500/20 text-violet-400">
                          {formatTrackedTime(t.totalTrackedSeconds)} tracked
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pb-3 space-y-3">
                      <div className="bg-muted/30 p-2.5 rounded-lg border border-border/20 text-xs text-muted-foreground italic">
                        "{lastComment}"
                      </div>
                      
                      {inlineRejectId === t._id ? (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Please specify why this task is rejected..."
                            value={inlineRejectComment}
                            onChange={e => setInlineRejectComment(e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-border bg-card text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            rows={2}
                          />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" className="h-7 text-xs rounded-md" onClick={() => { setInlineRejectId(null); setInlineRejectComment(""); }}>
                              Cancel
                            </Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs rounded-md font-semibold" onClick={() => handleInlineReject(t._id)} disabled={submitting || !inlineRejectComment.trim()}>
                              Send Rejection
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg text-muted-foreground hover:text-foreground" onClick={() => setDetailTask(t)}>
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg border-destructive/20 text-destructive hover:bg-destructive/10" onClick={() => { setInlineRejectId(t._id); setInlineRejectComment(""); }}>
                            Reject
                          </Button>
                          <Button size="sm" className="h-8 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold shadow-sm" onClick={() => handleInlineApprove(t._id)} disabled={submitting}>
                            Approve
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Employee-wise Workload Tracker */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Team Workload & Pending Tasks
            </h3>
            <p className="text-sm text-muted-foreground">Monitor pending tasks and allocate new work employee-wise</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {employees.filter(emp => emp.role === "employee").map(emp => {
            // Get pending tasks for this employee
            const empTasks = tasks.filter(t => t.assignedTo?._id === emp._id && !["Approved", "Completed"].includes(t.status))
            const inProgress = empTasks.filter(t => t.status === "In Progress").length
            const waitingReview = empTasks.filter(t => t.status === "Waiting for Review").length
            const accepted = empTasks.filter(t => t.status === "Accepted").length
            const notStarted = empTasks.filter(t => t.status === "Not Started" || t.status === "Reopened" || t.status === "Rejected").length

            const initials = emp.name ? emp.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "EM"

            return (
              <Card key={emp._id} className="border-border/40 bg-card/45 backdrop-blur-sm shadow-lg overflow-hidden flex flex-col justify-between group hover:border-primary/20 transition-all duration-200">
                <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between space-y-0 gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center shadow-inner">
                      {initials}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground/90 leading-tight">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-0.5">{emp.team?.name || "Employee"}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    onClick={() => openCreateForEmployee(emp._id)}
                    title={`Assign task to ${emp.name}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 flex-1 flex flex-col justify-between space-y-4">
                  {/* Status Metrics Strip */}
                  <div className="grid grid-cols-4 gap-2 text-center bg-muted/20 p-2 rounded-xl border border-border/30 text-xs">
                    <div>
                      <div className="font-bold text-foreground">{empTasks.length}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Total</div>
                    </div>
                    <div>
                      <div className="font-bold text-violet-400">{inProgress}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Active</div>
                    </div>
                    <div>
                      <div className="font-bold text-warning-foreground">{waitingReview}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Review</div>
                    </div>
                    <div>
                      <div className="font-bold text-slate-400">{notStarted + accepted}</div>
                      <div className="text-[8px] text-muted-foreground uppercase font-semibold mt-0.5">Pending</div>
                    </div>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {empTasks.length === 0 ? (
                      <div className="h-full min-h-[100px] flex flex-col items-center justify-center border border-dashed border-border/20 rounded-xl bg-muted/5 py-6">
                        <CheckCircle2 className="h-5 w-5 text-green-500/60 mb-1" />
                        <p className="text-[11px] text-muted-foreground font-medium">All tasks completed!</p>
                      </div>
                    ) : (
                      empTasks.map(t => (
                        <div
                          key={t._id}
                          onClick={() => setDetailTask(t)}
                          className="p-2.5 rounded-xl border border-border/40 hover:border-primary/20 bg-background/20 hover:bg-background/40 transition-colors cursor-pointer space-y-1 relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-bold text-foreground/90 line-clamp-2 leading-tight">
                              {t.title}
                            </span>
                            <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[7px] py-0 px-1 font-bold rounded-sm shrink-0">
                              {t.priority}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium">
                            <Badge variant={STATUS_VARIANTS[t.status]} className="text-[7px] py-0 px-1 rounded-sm">
                              {t.status}
                            </Badge>
                            {t.dueDate && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />
                                {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Task List */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">Team Tasks Tracker</CardTitle>
            <CardDescription>Overall tracking of work assigned to employees</CardDescription>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Input
              placeholder="🔍 Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background/50 border-border/40 max-w-[200px]"
            />
            <Badge variant="outline" className="h-6 font-mono rounded-lg shrink-0">
              {tasks.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Assigned To</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                  <TableHead className="font-semibold text-foreground/80">Status Workflow</TableHead>
                  <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Clock className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-sm">Loading tasks...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-16">
                      <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-foreground">No tasks found</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {searchQuery ? `We couldn't find any tasks matching "${searchQuery}".` : 'Click "Create Task" to assign your first task to the team.'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredTasks.map(t => {
                      const nextOptions = getNextStatusesForManager(t)
                      const isSelfCreated = t.assignedBy?._id === t.assignedTo?._id || t.assignedBy === t.assignedTo
                      
                      return (
                        <motion.tr
                          key={t._id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.8 }}
                          className="border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => setDetailTask(t)}
                        >
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-foreground/90 flex items-center gap-1.5">
                              {t.title}
                              {isSelfCreated && (
                                <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                              )}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
                              {t.category}
                              {t.totalTrackedSeconds > 0 && (
                                <>
                                  <span className="text-muted-foreground/40">•</span>
                                  <span className="text-violet-400">{formatTrackedTime(t.totalTrackedSeconds)} tracked</span>
                                </>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[9px] font-bold flex items-center justify-center">
                              {t.assignedTo?.name ? t.assignedTo.name[0].toUpperCase() : "—"}
                            </div>
                            <span>{t.assignedTo?.name || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[10px] py-0.5 px-2 rounded-md font-bold">
                            {t.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {t.dueDate ? (
                            (() => {
                              const isOverdue = new Date(t.dueDate) < new Date() && !["Completed", "Approved"].includes(t.status)
                              return (
                                <span className={`flex items-center gap-1.5 ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                                  {isOverdue && "⚠️ "}
                                  {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              )
                            })()
                          ) : "—"}
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {nextOptions.length > 0 ? (
                            <select
                              value={t.status}
                              onChange={e => {
                                setDetailTask(t)
                                // If they select a review action, open details modal directly so they can write Native comments
                                if (["Approved", "Rejected", "Reopened"].includes(e.target.value)) {
                                  return
                                }
                                // Update other transitions inline directly
                                axios.put(`${API_BASE}/api/tasks/${t._id}/status`, { status: e.target.value })
                                  .then(() => loadData())
                                  .catch(err => console.error(err))
                              }}
                              className="h-8 rounded-lg border border-input bg-card text-foreground px-2 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value={t.status}>{t.status}</option>
                              {nextOptions.map(opt => (
                                <option key={opt} value={opt}>➔ {opt}</option>
                              ))}
                            </select>
                          ) : (
                            <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                              {t.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden hidden sm:block">
                              <div 
                                className="bg-primary h-full rounded-full transition-all duration-300"
                                style={{ width: `${t.progressPercentage}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs font-semibold text-foreground/80">
                              {t.progressPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px] border-border/60">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create New Task</DialogTitle>
            <DialogDescription>Assign tasks, set estimate hours, and select priorities</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-foreground/80 font-medium">Title *</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Build API login workflow"
                className="h-10 rounded-lg"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-assignee" className="mb-1 text-foreground/80 font-medium">Assigned To *</Label>
                <Select
                  value={taskForm.assignedTo}
                  onValueChange={val => {
                    const chosenEmp = employees.find(emp => emp._id === val)
                    const deptId = chosenEmp?.department?._id || chosenEmp?.department || ""
                    setTaskForm(f => ({ ...f, assignedTo: val, department: deptId }))
                  }}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="— Select Assignee —" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => {
                      const initials = emp.name ? emp.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "EM"
                      return (
                        <SelectItem key={emp._id} value={emp._id}>
                          <span className="flex items-center gap-2">
                            <span className="h-4 w-4 rounded-full bg-primary/10 border border-primary/20 text-primary text-[8px] font-bold flex items-center justify-center">
                              {initials}
                            </span>
                            {emp.name}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex flex-col">
                <Label htmlFor="task-priority" className="mb-1 text-foreground/80 font-medium">Priority</Label>
                <Select
                  value={taskForm.priority}
                  onValueChange={val => setTaskForm(f => ({ ...f, priority: val }))}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Select Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500"></span> Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500"></span> High
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 border border-border/40 py-2"
              onClick={() => setShowAdvancedTaskForm(!showAdvancedTaskForm)}
            >
              {showAdvancedTaskForm ? "▲ Hide Advanced Settings" : "▼ Show Advanced Settings (Description, Category, Dept, Hours, Due Date)"}
            </Button>

            {showAdvancedTaskForm && (
              <div className="space-y-4 border-t border-border/40 pt-4 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <Label htmlFor="task-desc" className="text-foreground/80 font-medium">Description</Label>
                  <Textarea
                    id="task-desc"
                    value={taskForm.description}
                    onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Add task specification details..."
                    className="rounded-lg"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 flex flex-col">
                    <Label htmlFor="task-cat" className="mb-1 text-foreground/80 font-medium">Category</Label>
                    <Select
                      value={customCategoryActive ? "custom" : (CATEGORY_PRESETS.includes(taskForm.category) ? taskForm.category : "General")}
                      onValueChange={val => {
                        if (val === "custom") {
                          setCustomCategoryActive(true);
                          setTaskForm(f => ({ ...f, category: "" }));
                        } else {
                          setCustomCategoryActive(false);
                          setTaskForm(f => ({ ...f, category: val }));
                        }
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-lg">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORY_PRESETS.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                        <SelectItem value="custom">Custom...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 flex flex-col">
                    <Label htmlFor="task-dept" className="mb-1 text-foreground/80 font-medium">Department</Label>
                    <Select
                      value={taskForm.department || "none"}
                      onValueChange={val => setTaskForm(f => ({ ...f, department: val === "none" ? "" : val }))}
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

                {customCategoryActive && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <Label htmlFor="task-cat-custom" className="text-foreground/80 font-medium">Custom Category Name *</Label>
                    <Input
                      id="task-cat-custom"
                      value={taskForm.category}
                      onChange={e => setTaskForm(f => ({ ...f, category: e.target.value }))}
                      placeholder="Enter custom category..."
                      className="h-10 rounded-lg"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="task-hours" className="text-foreground/80 font-medium">Estimated Hours</Label>
                    <Input
                      type="number"
                      id="task-hours"
                      value={taskForm.estimatedHours}
                      onChange={e => setTaskForm(f => ({ ...f, estimatedHours: Number(e.target.value) }))}
                      min="0"
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="task-due" className="text-foreground/80 font-medium">Due Date</Label>
                    <Input
                      type="date"
                      id="task-due"
                      value={taskForm.dueDate}
                      onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="h-10 rounded-lg text-foreground bg-transparent"
                    />
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg h-10 shadow font-semibold" disabled={submitting}>
                {submitting ? "Creating…" : "Assign Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail & Approval Modal */}
      <Dialog open={detailTask !== null} onOpenChange={() => setDetailTask(null)}>
        {detailTask && (
          <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto border-border/60">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6 gap-4">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">{detailTask.title}</DialogTitle>
                <Badge variant={STATUS_VARIANTS[detailTask.status] || "default"} className="font-bold shrink-0">
                  {detailTask.status}
                </Badge>
              </div>
              <DialogDescription className="text-xs uppercase tracking-wider font-semibold text-primary">{detailTask.category}</DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* VISUAL WORKFLOW STEPPER */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Workflow Timeline</h4>
                <div className="flex items-center justify-between relative px-2 py-4 bg-muted/20 border border-border/30 rounded-xl overflow-x-auto">
                  {getStepperSteps(detailTask).map((step, idx, arr) => {
                    const isSelfCreated = detailTask.assignedBy?._id === detailTask.assignedTo?._id || detailTask.assignedBy === detailTask.assignedTo
                    
                    // Determine status active / completed status
                    const currentIdx = arr.findIndex(s => s.key === detailTask.status)
                    const isCompleted = idx < currentIdx || detailTask.status === "Approved" || detailTask.status === "Completed"
                    const isActive = idx === currentIdx && detailTask.status !== "Approved" && detailTask.status !== "Completed"

                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                          <div
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCompleted 
                                ? "bg-green-500 text-white shadow-sm border border-green-600" 
                                : isActive 
                                  ? "bg-primary text-primary-foreground font-extrabold ring-4 ring-primary/20 scale-110" 
                                  : "bg-muted/80 text-muted-foreground border border-border"
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </div>
                          <span className={`text-[10px] font-bold whitespace-nowrap ${
                            isActive ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {idx < arr.length - 1 && (
                          <div className={`h-0.5 flex-1 min-w-[30px] mx-2 ${
                            isCompleted ? "bg-green-500" : "bg-border"
                          }`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Task Details Info */}
              <div className="grid grid-cols-2 gap-4 text-xs border-y border-border/40 py-4 bg-muted/10 px-3 rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4 text-primary" />
                  <span>Assigned To: <strong className="text-foreground">{detailTask.assignedTo?.name || "—"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>Due: <strong className="text-foreground">{detailTask.dueDate ? new Date(detailTask.dueDate).toLocaleDateString() : "—"}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Est. Hours: <strong className="text-foreground">{detailTask.estimatedHours} hrs</strong></span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 text-violet-400" />
                  <span>Time Tracked: <strong className="text-violet-400">{formatTrackedTime(detailTask.totalTrackedSeconds)}</strong></span>
                </div>
                <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>Progress: <strong className="text-foreground">{detailTask.progressPercentage}%</strong></span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</h4>
                <p className="text-sm text-foreground bg-muted/20 p-3 rounded-xl border border-border/30 whitespace-pre-wrap leading-relaxed">
                  {detailTask.description || "No description provided."}
                </p>
              </div>

              {/* Approval Gating Controls */}
              {(detailTask.status === "Waiting for Review" || detailTask.status === "Completed") && (
                <div className="space-y-3.5 p-4 rounded-xl border border-warning/30 bg-warning/5">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-warning" />
                    Pending Work Review
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="review-comm" className="text-xs text-muted-foreground">Review Feedback Comments (required)</Label>
                    <Input
                      id="review-comm"
                      placeholder="Add design review notes, request fixes, or log acceptance..."
                      value={reviewComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-lg font-semibold"
                      onClick={() => handleReview("Rejected")}
                      disabled={submitting || !reviewComment.trim()}
                    >
                      Reject Work
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-lg font-semibold shadow"
                      onClick={() => handleReview("Approved")}
                      disabled={submitting || !reviewComment.trim()}
                    >
                      Approve Work
                    </Button>
                  </div>
                </div>
              )}

              {/* Activity & Workflow History Tabs */}
              <div className="pt-2">
                <Tabs defaultValue="comments" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-muted/60 p-1 rounded-xl h-9 mb-4">
                    <TabsTrigger value="comments" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground">
                      Discussion ({detailTask.comments?.length || 0})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground">
                      Workflow Audit Log ({detailTask.history?.length || 0})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="comments" className="space-y-3 mt-0 focus-visible:outline-none">
                    {/* Comment log stream */}
                    <ScrollArea className="h-[180px] border border-border/40 rounded-xl bg-muted/10 p-3">
                      {detailTask.comments.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-8">
                          <p className="text-xs text-muted-foreground italic">No activities logged yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {detailTask.comments.map(c => {
                            const authorInitials = c.author?.name ? c.author.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "US"
                            return (
                              <div key={c._id} className="text-xs flex gap-2.5 items-start">
                                <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 text-primary font-bold flex items-center justify-center text-[9px] shrink-0">
                                  {authorInitials}
                                </div>
                                <div className="flex-1 bg-card/60 p-2.5 rounded-lg border border-border/30 space-y-1 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-foreground/80">{c.author?.name} <span className="text-[10px] text-muted-foreground font-normal">({c.author?.role})</span></span>
                                    <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{c.text}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>

                    {/* Post comment form */}
                    <form onSubmit={handlePostComment} className="flex gap-2">
                      <Input
                        placeholder="Write a message..."
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        className="flex-1 h-9 text-xs rounded-lg"
                      />
                      <Button type="submit" size="icon" className="h-9 w-9 rounded-lg shrink-0">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="history" className="space-y-3 mt-0 focus-visible:outline-none">
                    {/* History log stream */}
                    <ScrollArea className="h-[220px] border border-border/40 rounded-xl bg-muted/10 p-3">
                      {!detailTask.history || detailTask.history.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-8">
                          <p className="text-xs text-muted-foreground italic">No state changes logged yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 pl-3 relative border-l border-border/60 ml-2.5 my-2">
                          {detailTask.history.map((h, i) => {
                            const changerInitials = h.changedBy?.name 
                              ? h.changedBy.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
                              : "US"
                            return (
                              <div key={h._id || i} className="relative text-xs space-y-1">
                                {/* Connector dot */}
                                <div className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background ring-4 ring-primary/10" />
                                
                                <div className="flex justify-between items-center pl-1">
                                  <span className="font-bold text-foreground/80">
                                    {h.changedBy?.name || "System"} 
                                    <span className="text-[10px] text-muted-foreground font-normal"> ({h.changedBy?.role || "System"})</span>
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                                
                                <div className="bg-card/50 p-2.5 rounded-lg border border-border/20 pl-4 ml-1 space-y-1.5 shadow-sm">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-muted-foreground bg-muted/40 py-0.5 px-1.5 rounded text-[9px] uppercase tracking-wider">{h.fromStatus}</span>
                                    <span className="text-muted-foreground/50 text-[10px]">➔</span>
                                    <span className="font-bold text-primary bg-primary/10 py-0.5 px-1.5 rounded text-[9px] uppercase tracking-wider">{h.toStatus}</span>
                                  </div>
                                  {h.comment && (
                                    <p className="text-muted-foreground italic pl-1.5 text-[11px] border-l-2 border-primary/20 leading-relaxed">
                                      "{h.comment}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
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
          <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between pb-3 gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  <FileText className="h-5 w-5 text-primary" />
                  Team Work Logs
                  <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs ml-1 font-mono">
                    {filteredLogs.length} total
                  </Badge>
                </CardTitle>
                <CardDescription>Daily productivity reports submitted by employees</CardDescription>
              </div>
              <select
                value={logFilterEmployee}
                onChange={e => setLogFilterEmployee(e.target.value)}
                className="h-10 rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-w-[200px]"
              >
                <option value="" className="bg-card text-foreground">— Filter Employee —</option>
                {employees.filter(e => e.role === "employee").map(emp => (
                  <option key={emp._id} value={emp._id} className="bg-card text-foreground">{emp.name}</option>
                ))}
              </select>
            </CardHeader>
            <CardContent>
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground/80">Employee</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Date</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Summary of Work Done</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Hours</TableHead>
                      <TableHead className="font-semibold text-foreground/80">Next Day Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10">
                          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <AlertCircle className="h-5 w-5" />
                            <span className="text-xs">No daily work logs found.</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.slice(0, 10).map(log => (
                      <TableRow key={log._id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 border border-primary/25 text-primary text-[9px] font-bold flex items-center justify-center">
                              {log.employee?.name ? log.employee.name[0].toUpperCase() : "E"}
                            </div>
                            <span>{log.employee?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap text-xs font-semibold uppercase tracking-wider">
                          {new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-sm text-foreground/80" title={log.todaysWork}>{log.todaysWork}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs font-bold rounded-md bg-muted/40">{log.hoursWorked}h</Badge>
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          <p className="truncate text-xs text-muted-foreground" title={log.nextPlan}>{log.nextPlan || "—"}</p>
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
