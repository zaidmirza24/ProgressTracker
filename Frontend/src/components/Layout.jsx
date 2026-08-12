import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTimer } from "../context/TimerContext"
import { useTheme } from "../context/ThemeContext"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "motion/react"
import {
  Building2, Users, ClipboardList, Timer, FileText,
  LayoutDashboard, LogOut, ChevronRight, BarChart3, UserPlus,
  Play, Pause, Square, Menu, X, ArrowUpRight, Sun, Moon
} from "lucide-react"

const ROLE_CONFIG = {
  super_admin: {
    label: "Super Admin",
    variant: "violet",
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
    label: "Manager",
    variant: "info",
    links: [
      { to: "/manager", icon: LayoutDashboard, label: "Dashboard" },
    ],
    placeholders: [
      { icon: ClipboardList, label: "Create Tasks" },
      { icon: BarChart3, label: "Team Reports" },
    ]
  },
  employee: {
    label: "Employee",
    variant: "secondary",
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
  const { theme, toggleTheme } = useTheme()
  const { activeSession, elapsedSeconds, isRunning, pauseTimer, resumeTimer, stopTimer } = useTimer()
  const [mobileOpen, setMobileOpen] = useState(false)

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
  const userInitials = user.name ? user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "US"

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Brand Logo */}
      <div className="p-6 flex items-center justify-between border-b border-sidebar-border/40">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-cyan-400 flex items-center justify-center glow-primary">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              ProgressTracker
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
              v1.0.0
            </span>
          </div>
        </div>
        <Badge variant={config.variant} className="text-[10px] px-2 py-0.5 rounded-md font-medium tracking-wide">
          {config.label}
        </Badge>
      </div>

      {/* User Card */}
      <div className="px-6 py-4 flex items-center gap-3 border-b border-sidebar-border/30 bg-muted/10">
        <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
          {userInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-grow p-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground tracking-widest px-3 mb-2 uppercase">NAVIGATION</p>
          {config.links.map((link) => {
            const Icon = link.icon
            const isActive = location.pathname === link.to
            return (
              <Link key={link.to} to={link.to} onClick={() => setMobileOpen(false)}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 text-sm h-10 transition-all rounded-lg relative ${
                    isActive 
                      ? "bg-primary/10 text-primary hover:bg-primary/15 font-semibold accent-bar" 
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-primary" : ""}`} />
                  {link.label}
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto text-primary" />}
                </Button>
              </Link>
            )
          })}
        </div>

        {/* Placeholders */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase">FUTURE MODULES</p>
            <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold">MVP</span>
          </div>
          {config.placeholders.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.label}
                variant="ghost"
                className="w-full justify-start gap-3 text-sm h-10 text-muted-foreground/40 hover:bg-transparent cursor-not-allowed"
                disabled
              >
                <Icon className="h-4.5 w-4.5" />
                {item.label}
                <ArrowUpRight className="h-3 w-3 ml-auto opacity-30" />
              </Button>
            )
          })}
        </div>
      </div>

      {/* Live Timer Widget */}
      {user.role === "employee" && activeSession && (
        <div className={`p-4 m-4 rounded-xl bg-gradient-to-b from-card to-card/50 border shadow-lg space-y-3 relative overflow-hidden group transition-all duration-300 ${
          isRunning ? "border-primary/45 ring-1 ring-primary/20 shadow-primary/5" : "border-border/80"
        }`}>
          <div className="absolute top-0 right-0 h-24 w-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-all duration-300"></div>
          
          <div className="space-y-1 relative">
            <span className="text-[10px] text-primary font-bold tracking-widest flex items-center gap-1.5">
              <span className="pulse-dot"></span>
              ACTIVE TRACKER
            </span>
            <p className="text-xs font-semibold truncate text-foreground/90">{activeSession.task?.title}</p>
          </div>
          
          <div className="flex items-center justify-between relative">
            <span className={`font-mono text-2xl font-bold tracking-tight transition-colors duration-300 ${isRunning ? "text-primary animate-pulse" : "text-foreground/95"}`}>
              {formatTime(elapsedSeconds)}
            </span>
            
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg bg-background/50 hover:bg-accent/80 transition-colors" 
                  onClick={pauseTimer}
                >
                  <Pause className="h-3.5 w-3.5 text-foreground" />
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg bg-background/50 hover:bg-accent/80 transition-colors" 
                  onClick={resumeTimer}
                >
                  <Play className="h-3.5 w-3.5 text-primary" />
                </Button>
              )
              }
              <Button 
                variant="destructive" 
                size="icon" 
                className="h-8 w-8 rounded-lg bg-destructive/10 border border-destructive/20 hover:bg-destructive/20 transition-colors" 
                onClick={stopTimer}
              >
                <Square className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: Theme Toggle + Logout */}
      <div className="p-4 border-t border-sidebar-border/40 bg-sidebar/50 flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="relative h-10 w-16 rounded-full border border-border bg-muted/60 flex items-center transition-colors duration-300 hover:border-primary/40 hover:bg-muted flex-shrink-0 overflow-hidden"
        >
          {/* Track icons */}
          <Sun className="absolute left-2 h-3.5 w-3.5 text-warning/70" />
          <Moon className="absolute right-2 h-3.5 w-3.5 text-primary/70" />
          {/* Thumb */}
          <motion.div
            layout
            animate={{ x: theme === "dark" ? 28 : 4 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="h-7 w-7 rounded-full bg-primary shadow-md flex items-center justify-center z-10 flex-shrink-0"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === "dark" ? (
                <motion.span
                  key="moon"
                  initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.18 }}
                >
                  <Moon className="h-3.5 w-3.5 text-primary-foreground" />
                </motion.span>
              ) : (
                <motion.span
                  key="sun"
                  initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.18 }}
                >
                  <Sun className="h-3.5 w-3.5 text-primary-foreground" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </button>

        {/* Logout */}
        <Button
          variant="ghost"
          className="flex-1 justify-start gap-3 text-sm h-10 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
          onClick={logout}
        >
          <LogOut className="h-4.5 w-4.5" />
          Logout
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar — fixed height, no scroll on page */}
      <aside className="hidden lg:flex lg:flex-col w-64 border-r border-border bg-sidebar flex-shrink-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 border-b border-border bg-sidebar px-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">ProgressTracker</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black z-40"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed top-0 bottom-0 left-0 w-64 bg-sidebar border-r border-border z-50 shadow-2xl"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area — only this scrolls */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto pt-16 lg:pt-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}

export default Layout
