import { useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../../lib/api"
import { useAuth } from "../../context/AuthContext"
import { useTimer } from "../../context/TimerContext"
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
  ClipboardList, CheckCircle2, Clock, Calendar,
  MessageSquare, Send, User, BarChart3,
  Play, Pause, Square, AlertCircle, Plus, Check, Loader2, Repeat, ArrowRightCircle,
  Kanban, List
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"

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

const EmployeeDashboard = () => {
  const { user } = useAuth()
  const { activeSession, elapsedSeconds, isRunning, isPending, startTimer, pauseTimer, resumeTimer, stopTimer, refreshTimer } = useTimer()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailTask, setDetailTask] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [todayHours, setTodayHours] = useState(0)
  const [viewMode, setViewMode] = useState("board") // "board" | "list"
  
  // Forms
  const [taskForm, setTaskForm] = useState({
    title: "", description: "", category: "General",
    priority: "medium", estimatedHours: 0, dueDate: getLocalDateString()
  })
  const [customCategoryActive, setCustomCategoryActive] = useState(false)
  const [transitionComment, setTransitionComment] = useState("")
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = searchQuery
      ? (t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         t.priority?.toLowerCase().includes(searchQuery.toLowerCase()))
      : true
    return matchesSearch
  })

  const loadTasks = async () => {
    try {
      // Provision daily tasks first (idempotent — safe to call every time)
      await axios.get(`${API_BASE}/api/tasks/daily`).catch(() => {}) // non-blocking, fail silently
      const [tasksRes, hoursRes] = await Promise.all([
        axios.get(`${API_BASE}/api/tasks`),
        axios.get(`${API_BASE}/api/work-sessions/today-hours`)
      ])
      setTasks(tasksRes.data.tasks)
      setTodayHours(hoursRes.data.hoursWorked)
    } catch (err) {
      console.error("Error loading employee tasks:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [activeSession]) // Reload when timer starts/stops to update todayHours

  // Sync details dialog with updated task context if it changes in the list
  useEffect(() => {
    if (detailTask) {
      const updated = tasks.find(t => t._id === detailTask._id)
      if (updated) setDetailTask(updated)
    }
  }, [tasks])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await axios.post(`${API_BASE}/api/tasks`, taskForm)
      await loadTasks()
      setCreateOpen(false)
      setTaskForm({
        title: "", description: "", category: "General",
        priority: "medium", estimatedHours: 0, dueDate: getLocalDateString()
      })
      setCustomCategoryActive(false)
    } catch (err) {
      console.error("Error creating self-assigned task:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusTransition = async (newStatus, taskId = null) => {
    const targetTaskId = taskId || detailTask?._id
    if (!targetTaskId) return
    setSubmitting(true)
    try {
      const res = await axios.put(`${API_BASE}/api/tasks/${targetTaskId}/status`, {
        status: newStatus,
        comment: transitionComment
      })
      if (detailTask && detailTask._id === targetTaskId) {
        setDetailTask(res.data.task)
      }
      setTransitionComment("")
      await loadTasks()
      
      // If the changed task is the active session task, refresh the timer to sync status
      if (activeSession && activeSession.task?._id === targetTaskId) {
        if (typeof refreshTimer === "function") {
          await refreshTimer()
        }
      }
    } catch (err) {
      console.error("Error updating status:", err)
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
      await loadTasks()
    } catch (err) {
      console.error("Error adding comment:", err)
    }
  }

  const handlePlayRow = async (e, taskId) => {
    e.stopPropagation()
    await startTimer(taskId)
    await loadTasks() // Refresh task state in case status updated to In Progress
  }

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = Math.floor(totalSecs % 60)
    const pad = (num) => String(num).padStart(2, "0")
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    return `${pad(mins)}:${pad(secs)}`
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

  // Get available transitions based on task type (self-assigned vs manager-assigned)
  const getNextStatuses = (task) => {
    const isSelfCreated = task.assignedBy?._id === task.assignedTo?._id || task.assignedBy === task.assignedTo

    if (isSelfCreated) {
      switch (task.status) {
        case "Not Started": return ["Accepted", "In Progress"]
        case "Accepted": return ["In Progress"]
        case "In Progress": return ["Completed"]
        case "Completed": return ["In Progress"] // Allow reopening completed self task
        default: return []
      }
    } else {
      switch (task.status) {
        case "Not Started": return ["Accepted", "In Progress"]
        case "Accepted": return ["In Progress"]
        case "In Progress": return ["Waiting for Review"]
        case "Rejected":
        case "Reopened": return ["In Progress"] // Allow starting rejected/reopened tasks
        default: return []
      }
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

  const getBoardColumns = () => {
    const columns = {
      todo: {
        title: "To Do / Pending",
        tasks: [],
        color: "border-slate-500 bg-slate-500/5",
        badgeColor: "bg-slate-500/10 text-slate-400",
        indicatorColor: "bg-slate-400"
      },
      inProgress: {
        title: "In Progress",
        tasks: [],
        color: "border-violet-500 bg-violet-500/5",
        badgeColor: "bg-violet-500/10 text-violet-400",
        indicatorColor: "bg-violet-500"
      },
      underReview: {
        title: "Under Review",
        tasks: [],
        color: "border-amber-500 bg-amber-500/5",
        badgeColor: "bg-amber-500/10 text-amber-400",
        indicatorColor: "bg-amber-500"
      },
      completed: {
        title: "Completed",
        tasks: [],
        color: "border-green-500 bg-green-500/5",
        badgeColor: "bg-green-500/10 text-green-400",
        indicatorColor: "bg-green-500"
      }
    }

    filteredTasks.forEach(task => {
      switch (task.status) {
        case "Not Started":
        case "Accepted":
        case "Reopened":
        case "Rejected":
          columns.todo.tasks.push(task)
          break
        case "In Progress":
          columns.inProgress.tasks.push(task)
          break
        case "Waiting for Review":
          columns.underReview.tasks.push(task)
          break
        case "Completed":
        case "Approved":
          columns.completed.tasks.push(task)
          break
        default:
          columns.todo.tasks.push(task)
      }
    })

    return columns
  }

  // Metrics
  const activeCount = tasks.filter(t => ["In Progress", "Accepted"].includes(t.status)).length
  const completedCount = tasks.filter(t => ["Approved", "Completed"].includes(t.status)).length

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-52" />
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
              <div className="grid grid-cols-5 gap-4 pb-2 border-b border-border/50">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-3" />)}
              </div>
              {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-5 gap-4 py-2">
                  {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-4" />)}
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
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            My Workspace
          </h2>
          <p className="text-muted-foreground">
            Welcome back, <strong className="text-foreground">{user?.name}</strong>. Start timers on your assigned tasks, record log hours, and submit work reviews.
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
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned Tasks</CardTitle>
            <ClipboardList className="h-4.5 w-4.5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{tasks.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending start or execution</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active Work Session</CardTitle>
            <Clock className={`h-4.5 w-4.5 ${activeSession ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-foreground">
              {activeSession ? formatTime(elapsedSeconds) : "00:00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {activeSession ? `Active: ${activeSession.task?.title}` : "No active timer"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed Tasks</CardTitle>
            <CheckCircle2 className="h-4.5 w-4.5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{completedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Marked completed or approved</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 card-hover relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-info rounded-l-md"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today's Tracked Time</CardTitle>
            <Clock className="h-4.5 w-4.5 text-info animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono tracking-tight text-info-foreground">{todayHours}h</div>
            <p className="text-xs text-muted-foreground mt-1">Cumulative time recorded today</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Daily Tasks Section ───────────────────────────────────────────── */}
      {(() => {
        const dailyTasks = tasks.filter(t => t.isDaily)
        const carryForward = dailyTasks.filter(t => !["Completed", "Approved"].includes(t.status))
        if (dailyTasks.length === 0) return null
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-foreground/80">Today's Daily Tasks</h3>
                <Badge variant="outline" className="text-[10px] font-mono rounded-lg h-5">{dailyTasks.length}</Badge>
              </div>
              {carryForward.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  <ArrowRightCircle className="h-3.5 w-3.5" />
                  {carryForward.length} pending / carry-forward
                </span>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dailyTasks.map(t => {
                const isDone = ["Completed", "Approved"].includes(t.status)
                const isActive = activeSession?.task?._id === t._id
                return (
                  <div
                    key={t._id}
                    onClick={() => setDetailTask(t)}
                    className={`relative cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
                      isDone
                        ? "border-green-500/30 bg-green-500/5 opacity-70"
                        : isActive
                        ? "border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-border/50 bg-card/60 hover:border-primary/30"
                    }`}
                  >
                    {/* Status indicator strip */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${isDone ? "bg-green-500" : isActive ? "bg-primary" : "bg-muted"}`} />
                    <div className="pl-2 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm font-bold leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {t.title}
                        </span>
                        {isDone
                          ? <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          : <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[9px] py-0 px-1.5 rounded-sm font-bold shrink-0">{t.priority}</Badge>
                        }
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="violet" className="text-[9px] py-0 px-1.5 rounded-sm font-bold uppercase">
                            <Repeat className="h-2.5 w-2.5 mr-0.5" />Daily
                          </Badge>
                          {t.totalTrackedSeconds > 0 && (
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {formatTrackedTime(t.totalTrackedSeconds)} tracked
                            </span>
                          )}
                        </div>
                        {!isDone && (
                          <button
                            onClick={e => { e.stopPropagation(); handlePlayRow(e, t._id) }}
                            className={`h-7 w-7 rounded-full flex items-center justify-center transition-all ${
                              isActive && isRunning
                                ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            }`}
                          >
                            {isActive && isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Task List */}
      <Card className="border-border/40 shadow-xl bg-card/40 backdrop-blur-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">My Assigned Tasks</CardTitle>
            <CardDescription>Track status changes and active timers below</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <Input
              placeholder="🔍 Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-xs rounded-lg bg-background/50 border-border/40 max-w-[200px]"
            />
            {/* View Mode Toggle */}
            <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/40 shrink-0">
              <Button
                variant={viewMode === "board" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 rounded-md text-[11px] gap-1.5 font-semibold ${
                  viewMode === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("board")}
              >
                <Kanban className="h-3 w-3" />
                Board
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className={`h-7 px-2.5 rounded-md text-[11px] gap-1.5 font-semibold ${
                  viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setViewMode("list")}
              >
                <List className="h-3 w-3" />
                List
              </Button>
            </div>

            <Badge variant="outline" className="h-6 font-mono rounded-lg">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <div className="border border-border/50 rounded-xl overflow-hidden bg-background/25">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-semibold text-foreground/80">Task</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Assigned By</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Priority</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Due Date</TableHead>
                    <TableHead className="font-semibold text-foreground/80">Status Workflow</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-center">Track Time</TableHead>
                    <TableHead className="font-semibold text-foreground/80 text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                          <Clock className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-sm">Loading assigned tasks...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-16">
                        <div className="max-w-[320px] mx-auto flex flex-col items-center justify-center gap-3">
                          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-6 w-6" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-foreground">No tasks found</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {searchQuery ? `We couldn't find any tasks matching "${searchQuery}".` : "Once your manager assigns a task to your name or you create one yourself, it will show up here."}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <AnimatePresence mode="popLayout">
                      {filteredTasks.map(t => {
                        const isTaskActive = activeSession && activeSession.task?._id === t._id
                        const nextOptions = getNextStatuses(t)
                        const isSelfCreated = t.assignedBy?._id === t.assignedTo?._id || t.assignedBy === t.assignedTo
                        
                        return (
                          <motion.tr
                            key={t._id}
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ type: "spring", stiffness: 400, damping: 38, mass: 0.8 }}
                            className={`border-b border-border/40 hover:bg-muted/30 cursor-pointer transition-colors ${
                              isTaskActive ? "bg-primary/[0.03] hover:bg-primary/[0.06]" : ""
                            }`}
                            onClick={() => setDetailTask(t)}
                          >
                            <TableCell className="font-medium">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-bold text-foreground/90 group-hover:text-primary transition-colors flex items-center gap-1.5 flex-wrap">
                                {t.title}
                                {isSelfCreated && !t.isDaily && (
                                  <Badge variant="violet" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                                )}
                                {t.isDaily && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-primary/30 text-primary bg-primary/5">
                                    Daily
                                  </Badge>
                                )}
                                {t.isCarryForward && (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                                    Pending
                                  </Badge>
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
                              <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                {t.assignedBy?.name ? t.assignedBy.name[0].toUpperCase() : "M"}
                              </div>
                              <span>{isSelfCreated ? "Self-Assigned" : (t.assignedBy?.name || "Manager")}</span>
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
                                    <Calendar className="h-3.5 w-3.5" />
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
                                  handleStatusTransition(e.target.value, t._id)
                                }}
                                className="h-8 rounded-lg border border-input bg-card text-foreground px-2 py-0.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              >
                                <option value={t.status}>{t.status}</option>
                                {nextOptions.map(opt => (
                                  <option key={opt} value={opt}>➔ {opt === "Completed" ? "Complete Task" : opt}</option>
                                ))}
                              </select>
                            ) : (
                              <Badge variant={STATUS_VARIANTS[t.status] || "default"} className="text-[10px] py-0.5 px-2 rounded-md font-bold">
                                {t.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                            {isTaskActive ? (
                              <div className="flex items-center justify-center gap-1">
                                {isRunning ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-60"
                                    onClick={pauseTimer}
                                    disabled={isPending}
                                    title="Pause timer"
                                  >
                                    {isPending
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Pause className="h-4 w-4" />}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-green-500 hover:text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                                    onClick={resumeTimer}
                                    disabled={isPending}
                                    title="Resume timer"
                                  >
                                    {isPending
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <Play className="h-4 w-4" />}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-60"
                                  onClick={stopTimer}
                                  disabled={isPending}
                                  title="Stop timer"
                                >
                                  {isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Square className="h-4 w-4" />}
                                </Button>
                              </div>
                            ) : (
                              !["Completed", "Approved", "Waiting for Review"].includes(t.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                                  onClick={e => handlePlayRow(e, t._id)}
                                  disabled={isPending}
                                  title="Start timer"
                                >
                                  {isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Play className="h-4 w-4" />}
                                </Button>
                              )
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
          ) : (
            /* Kanban Board View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-6 lg:gap-y-0 lg:divide-x lg:divide-border/60">
              {Object.entries(getBoardColumns()).map(([colId, col]) => (
                <div key={colId} className="flex flex-col space-y-3 lg:px-4 first:lg:pl-0 last:lg:pr-0">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${col.indicatorColor}`} />
                      <h3 className="font-bold text-xs uppercase tracking-wider text-foreground/80">{col.title}</h3>
                    </div>
                    <Badge variant="outline" className={`font-mono text-[10px] font-semibold rounded-md ${col.badgeColor}`}>
                      {col.tasks.length}
                    </Badge>
                  </div>

                  {/* Column Task Cards */}
                  <div className="flex flex-col gap-3 min-h-[350px] rounded-xl bg-muted/5 border border-dashed border-border/10 p-2">
                    {col.tasks.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border/15 rounded-xl bg-card/10 h-full min-h-[150px]"
                      >
                        <span className="text-[11px] text-muted-foreground font-medium">No tasks</span>
                      </motion.div>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {col.tasks.map(t => {
                          const isTaskActive = activeSession && activeSession.task?._id === t._id
                          const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && !["Completed", "Approved"].includes(t.status)
                          const isSelfCreated = t.assignedBy?._id === t.assignedTo?._id || t.assignedBy === t.assignedTo
                          const nextOptions = getNextStatuses(t)

                          return (
                            <motion.div
                              key={t._id}
                              layoutId={t._id}
                              layout
                              initial={{ opacity: 0, y: 16, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.94, y: -8 }}
                              transition={{
                                type: "spring",
                                stiffness: 450,
                                damping: 38,
                                mass: 0.9,
                                layout: { type: "spring", stiffness: 400, damping: 36 }
                              }}
                              onClick={() => setDetailTask(t)}
                              className={`relative flex flex-col justify-between p-4 rounded-xl border bg-card/30 hover:bg-card/60 backdrop-blur-sm cursor-pointer ${
                                isTaskActive
                                  ? "border-primary/45 shadow-sm ring-1 ring-primary/20 bg-primary/[0.02]"
                                  : isOverdue
                                    ? "border-destructive/40 bg-destructive/[0.01] hover:border-destructive/60"
                                    : "border-border/50 hover:border-primary/30"
                              }`}
                              whileHover={{ y: -2, boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                            >
                              {/* Left indicator accent */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                                isTaskActive ? "bg-primary" : 
                                isOverdue ? "bg-destructive" :
                                colId === "todo" ? "bg-slate-500" : 
                                colId === "inProgress" ? "bg-violet-500" : 
                                colId === "underReview" ? "bg-amber-500" : "bg-green-500"
                              }`} />

                            <div className="pl-1.5 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate max-w-[120px]">
                                  {t.category}
                                </span>
                                <Badge variant={PRIORITY_VARIANTS[t.priority]} className="capitalize text-[8px] py-0 px-1.5 font-bold rounded-sm shrink-0">
                                  {t.priority}
                                </Badge>
                              </div>

                              <h4 className="text-sm font-bold text-foreground leading-snug tracking-tight">
                                {t.title}
                              </h4>

                              {/* Action Badges */}
                              <div className="flex flex-wrap gap-1">
                                {isSelfCreated && !t.isDaily && (
                                  <Badge variant="violet" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase">Self</Badge>
                                )}
                                {t.isDaily && (
                                  <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase border-primary/30 text-primary bg-primary/5">
                                    Daily
                                  </Badge>
                                )}
                                {t.isCarryForward && (
                                  <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold rounded-sm uppercase border-amber-500/30 text-amber-400 bg-amber-500/5">
                                    Pending
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Separator line */}
                            <div className="h-px bg-border/30 my-3 ml-1.5" />

                            <div className="pl-1.5 flex flex-col gap-2.5">
                              {/* Metadata row */}
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-4.5 w-4.5 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0 border border-border/40">
                                    {t.assignedBy?.name ? t.assignedBy.name[0].toUpperCase() : "M"}
                                  </div>
                                  <span className="truncate max-w-[80px]">
                                    {isSelfCreated ? "Self" : (t.assignedBy?.name || "Manager")}
                                  </span>
                                </div>

                                {t.dueDate && (
                                  <span className={`flex items-center gap-1 shrink-0 ${isOverdue ? "text-destructive font-semibold" : ""}`}>
                                    <Calendar className="h-3 w-3" />
                                    {isOverdue && "⚠️ "}
                                    {new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>

                              {/* Progress bar */}
                              <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                                <div className="flex-1 bg-muted/65 rounded-full h-1 overflow-hidden">
                                  <div 
                                    className="bg-primary h-full rounded-full transition-all duration-300"
                                    style={{ width: `${t.progressPercentage}%` }}
                                  ></div>
                                </div>
                                <span className="font-mono font-bold shrink-0">{t.progressPercentage}%</span>
                              </div>

                              {/* Bottom interactive controls */}
                              <div className="flex items-center justify-between gap-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col">
                                  <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-wider">
                                    {isTaskActive ? "Active Session" : "Tracked"}
                                  </span>
                                  <span className={`font-mono text-xs font-bold ${isTaskActive ? "text-primary animate-pulse" : "text-violet-400"}`}>
                                    {isTaskActive ? formatTime(elapsedSeconds) : formatTrackedTime(t.totalTrackedSeconds)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  {/* Play timer controls */}
                                  {isTaskActive ? (
                                    <div className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/40">
                                      {isRunning ? (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-md text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 disabled:opacity-60 animate-pulse"
                                          onClick={pauseTimer}
                                          disabled={isPending}
                                          title="Pause timer"
                                        >
                                          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pause className="h-3 w-3" />}
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 rounded-md text-green-500 hover:text-green-600 hover:bg-green-500/10 disabled:opacity-60"
                                          onClick={resumeTimer}
                                          disabled={isPending}
                                          title="Resume timer"
                                        >
                                          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-60"
                                        onClick={stopTimer}
                                        disabled={isPending}
                                        title="Stop timer"
                                      >
                                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                                      </Button>
                                    </div>
                                  ) : (
                                    !["Completed", "Approved", "Waiting for Review"].includes(t.status) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-60"
                                        onClick={e => handlePlayRow(e, t._id)}
                                        disabled={isPending}
                                        title="Start timer"
                                      >
                                        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                                      </Button>
                                    )
                                  )}

                                  {/* Quick workflow transition selection */}
                                  {nextOptions.length > 0 && (
                                    <select
                                      value={t.status}
                                      onChange={e => {
                                        handleStatusTransition(e.target.value, t._id)
                                      }}
                                      className="h-7 max-w-[85px] rounded-md border border-input bg-card text-foreground px-1 py-0.5 text-[10px] font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                      <option value={t.status}>{t.status}</option>
                                      {nextOptions.map(opt => (
                                        <option key={opt} value={opt}>➔ {opt === "Completed" ? "Complete" : opt}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            </div>
                            </motion.div>
                          )
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px] border-border/60">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">Create Self Task</DialogTitle>
            <DialogDescription>Define a task to work on. It will be assigned to yourself automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-title" className="text-foreground/80 font-medium">Title *</Label>
              <Input
                id="task-title"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Wire up UI context"
                className="h-10 rounded-lg"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-desc" className="text-foreground/80 font-medium">Description</Label>
              <Textarea
                id="task-desc"
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Task specifications..."
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
            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" className="rounded-lg h-10" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="rounded-lg h-10 shadow font-semibold" disabled={submitting}>
                {submitting ? "Creating…" : "Add Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
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
                    const isClickable = (idx === currentIdx + 1 || (detailTask.status === "Not Started" && idx === currentIdx + 2)) && !["Approved", "Completed"].includes(detailTask.status)

                    return (
                      <div key={step.key} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1.5 relative z-10">
                          <button
                            type="button"
                            disabled={!isClickable || submitting}
                            onClick={() => handleStatusTransition(step.key)}
                            className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                              isCompleted 
                                ? "bg-green-500 text-white shadow-sm border border-green-600" 
                                : isActive 
                                  ? "bg-primary text-primary-foreground font-extrabold ring-4 ring-primary/20 scale-110" 
                                  : isClickable 
                                    ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 cursor-pointer animate-pulse" 
                                    : "bg-muted/80 text-muted-foreground border border-border"
                            }`}
                          >
                            {isCompleted ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                          </button>
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
                  <span>Assigned By: <strong className="text-foreground">{detailTask.assignedBy?.name || "Manager"}</strong></span>
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

              {/* Task Timer Panel */}
              {!["Completed", "Approved", "Waiting for Review"].includes(detailTask.status) && (
                <div className="space-y-3 p-4 rounded-xl border border-border/40 bg-gradient-to-r from-card to-card/60 flex items-center justify-between shadow-sm relative overflow-hidden">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold flex items-center gap-1.5 text-foreground/90">
                      <Clock className="h-4 w-4 text-primary" />
                      Time Tracking
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {activeSession && activeSession.task?._id === detailTask._id
                        ? "Currently active on your sidebar"
                        : "Start a timer session to begin"}
                    </p>
                  </div>
                  <div>
                    {activeSession && activeSession.task?._id === detailTask._id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold tracking-tight bg-muted border border-border px-3 py-1.5 rounded-lg">
                          {formatTime(elapsedSeconds)}
                        </span>
                        {isRunning ? (
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={pauseTimer} disabled={isPending}>
                            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Pause className="h-3.5 w-3.5 mr-1" />} Pause
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={resumeTimer} disabled={isPending}>
                            {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1 text-primary" />} Resume
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" className="h-8 px-3 rounded-lg disabled:opacity-60" onClick={stopTimer} disabled={isPending}>
                          {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Square className="h-3.5 w-3.5 mr-1" />} Stop
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="rounded-lg shadow font-semibold disabled:opacity-60" onClick={() => startTimer(detailTask._id)} disabled={isPending}>
                        {isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />} Start Timer
                      </Button>
                    )}
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
    </div>
  )
}

export default EmployeeDashboard
