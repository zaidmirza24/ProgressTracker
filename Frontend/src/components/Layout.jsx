import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTimer } from "../context/TimerContext"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { motion } from "motion/react"
import {
  Building2, Users, ClipboardList, Timer, FileText,
  LayoutDashboard, LogOut, ChevronRight, BarChart3, UserPlus,
  Play, Pause, Square
} from "lucide-react"

const ROLE_CONFIG = {
  super_admin: {
    label: "SUPER ADMIN",
    variant: "default",
    links: [
      { to: "/super-admin", icon: LayoutDashboard, label: "Admin Panel" },
    ],
    placeholders: [
      { icon: Building2, label: "Departments" },
      { icon: Users, label: "Teams" },
      { icon: UserPlus, label: "Manage Users" },
    ]
  },
  manager: {
    label: "MANAGER",
    variant: "secondary",
    links: [
      { to: "/manager", icon: LayoutDashboard, label: "Dashboard" },
    ],
    placeholders: [
      { icon: ClipboardList, label: "Create Tasks" },
      { icon: BarChart3, label: "Team Reports" },
    ]
  },
  employee: {
    label: "EMPLOYEE",
    variant: "outline",
    links: [
      { to: "/employee", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/work-logs", icon: FileText, label: "Work Log" },
    ],
    placeholders: [
      { icon: Timer, label: "Active Timer" },
    ]
  }
}

const Layout = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const { activeSession, elapsedSeconds, isRunning, pauseTimer, resumeTimer, stopTimer } = useTimer()

  const formatTime = (totalSecs) => {
    const hrs = Math.floor(totalSecs / 3600)
    const mins = Math.floor((totalSecs % 3600) / 60)
    const secs = Math.floor(totalSecs % 60)
    
    const pad = (num) => String(num).padStart(2, "0")
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
    }
    return `${pad(mins)}:${pad(secs)}`
  }

  if (!user) return null

  const config = ROLE_CONFIG[user.role] || ROLE_CONFIG.employee

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-64 border-r border-border bg-card flex flex-col"
      >
        {/* Logo */}
        <div className="p-5">
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            ProgressTracker
          </h3>
          <Badge variant={config.variant} className="mt-2 text-[10px] tracking-wider">
            {config.label}
          </Badge>
        </div>

        {/* User Info */}
        <div className="px-5 pb-4">
          <p className="text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-muted-foreground break-all">{user.email}</p>
        </div>

        <Separator />

        {/* Nav Links */}
        <nav className="flex-1 p-3 space-y-1">
          {config.links.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.to
            return (
              <Link key={link.to} to={link.to}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 text-sm"
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                  {isActive && <ChevronRight className="h-3 w-3 ml-auto" />}
                </Button>
              </Link>
            )
          })}

          {/* Placeholder future links */}
          {config.placeholders.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-start gap-2 text-sm text-muted-foreground opacity-50 cursor-not-allowed"
                disabled
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <span className="ml-auto text-[10px] uppercase tracking-wide">MVP</span>
              </Button>
            )
          })}
        </nav>

        {/* Floating Active Timer Widget */}
        {user.role === "employee" && activeSession && (
          <div className="p-4 mx-3 my-2 rounded-xl bg-muted/30 border border-border/40 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] text-yellow-500 font-semibold tracking-wider flex items-center gap-1">
                <Timer className="h-3 w-3 animate-pulse" /> ACTIVE TRACKER
              </span>
              <p className="text-xs font-semibold truncate text-foreground/90">{activeSession.task?.title}</p>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-bold tracking-tight text-foreground/90">
                {formatTime(elapsedSeconds)}
              </span>
              
              <div className="flex items-center gap-1.5">
                {isRunning ? (
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={pauseTimer}>
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon" className="h-7 w-7" onClick={resumeTimer}>
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="destructive" size="icon" className="h-7 w-7" onClick={stopTimer}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Logout */}
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-sm text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <motion.main
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1 p-8 overflow-auto"
      >
        <Outlet />
      </motion.main>
    </div>
  )
}

export default Layout
