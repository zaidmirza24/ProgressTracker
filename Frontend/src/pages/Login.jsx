import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useTheme } from "../context/ThemeContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion, AnimatePresence } from "motion/react"
import { 
  LogIn, 
  Loader2, 
  BarChart3, 
  Activity, 
  ShieldCheck, 
  Clock, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  Sun, 
  Moon, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Check 
} from "lucide-react"

const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showSeeder, setShowSeeder] = useState(false)
  const [seededRole, setSeededRole] = useState(null)
  
  const { user, login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate("/")
  }, [user, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSubmitting(true)

    const res = await login(email, password)
    
    if (res.success) {
      navigate("/")
    } else {
      setError(res.error)
      setSubmitting(false)
    }
  }

  const handleSeed = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setSeededRole(acc.role)
    setError("")
    setTimeout(() => {
      setSeededRole(null)
    }, 3000)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-background overflow-hidden relative">
      
      {/* Floating Theme Toggle (Top Right) */}
      <div className="absolute top-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleTheme}
          className="h-10 w-10 rounded-xl bg-card/45 border border-border/20 backdrop-blur-md flex items-center justify-center text-foreground hover:bg-card/65 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg cursor-pointer"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5 text-amber-400" />
          ) : (
            <Moon className="h-5 w-5 text-violet-500" />
          )}
        </button>
      </div>

      {/* Left panel - Branding and Info (hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:col-span-7 bg-sidebar border-r border-border/40 relative flex-col justify-between p-12 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-10%] left-[-10%] h-[50%] w-[50%] bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] bg-violet-500/5 rounded-full blur-3xl"></div>
        
        {/* Dot pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "20px 20px"
          }}
        ></div>

        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center glow-primary">
            <BarChart3 className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            ProgressTracker
          </span>
        </div>

        {/* Hero showcase */}
        <div className="space-y-8 my-auto relative z-10 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <Badge variant="violet" className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px]">
              Now in production
            </Badge>
            <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
              Real-time workspace <br />
              <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
                productivity tracking.
              </span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Track tasks, manage employee work logs, and log work hours automatically on a clean, centralized workspace dashboard.
            </p>
          </motion.div>

          {/* Core features list */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="grid sm:grid-cols-2 gap-4 pt-4"
          >
            {[
              { icon: Clock, title: "Server-side Timers", desc: "True duration calculations" },
              { icon: Activity, title: "Status Workflows", desc: "Track progress from creation to review" },
              { icon: ShieldCheck, title: "Role Management", desc: "Super Admins, Managers, Employees" },
              { icon: BarChart3, title: "Daily Work Logs", desc: "Pre-filled productivity summaries" }
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 items-start bg-card/30 border border-border/20 p-4 rounded-xl">
                <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <div className="text-xs text-muted-foreground/60 relative z-10 flex justify-between">
          <span>&copy; {new Date().getFullYear()} ProgressTracker Corp. All rights reserved.</span>
          <span className="hover:text-foreground cursor-pointer transition-colors">Privacy Policy</span>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="col-span-12 lg:col-span-5 flex items-center justify-center p-6 relative">
        
        {/* Dynamic Glow Background for Mobile/Tablet */}
        <div className="absolute inset-0 overflow-hidden lg:hidden pointer-events-none">
          <div className="absolute top-[10%] left-[10%] h-[250px] w-[250px] rounded-full bg-primary/8 dark:bg-primary/12 blur-[80px] animate-float-slow"></div>
          <div className="absolute bottom-[15%] right-[5%] h-[300px] w-[300px] rounded-full bg-violet-500/8 dark:bg-violet-500/12 blur-[100px] animate-float-reverse"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[350px] w-[350px] rounded-full bg-cyan-500/4 dark:bg-cyan-500/6 blur-[120px]"></div>
          
          {/* Cyber-mesh grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] text-foreground"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1.5px, transparent 0)",
              backgroundSize: "24px 24px"
            }}
          ></div>
        </div>

        {/* Desktop Ambient Glows */}
        <div className="absolute top-[-10%] right-[-10%] h-[40%] w-[40%] bg-primary/5 rounded-full blur-3xl lg:block hidden"></div>
        <div className="absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] bg-violet-500/5 rounded-full blur-3xl lg:block hidden"></div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[400px] relative z-10"
        >
          {/* Logo on mobile only */}
          <div className="flex flex-col items-center gap-3 justify-center mb-8 lg:hidden">
            <div className="relative group/logo">
              <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-primary via-cyan-400 to-violet-500 opacity-60 blur-md group-hover/logo:opacity-100 group-hover/logo:blur-lg transition-all duration-300 animate-pulse"></div>
              <div className="h-12 w-12 rounded-xl bg-background border border-border flex items-center justify-center relative z-10 shadow-lg">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="text-center">
              <span className="text-2xl font-extrabold tracking-tight text-foreground">
                ProgressTracker
              </span>
              <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">Workspace Analytics</p>
            </div>
          </div>

          {/* Card Container */}
          <Card className="border border-white/[0.08] dark:border-white/[0.04] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] bg-white/80 dark:bg-card/35 backdrop-blur-xl relative overflow-hidden group/card">
            {/* Ambient card highlight hover effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-transparent pointer-events-none opacity-0 group-hover/card:opacity-100 transition-opacity duration-700"></div>

            <CardHeader className="space-y-1.5 pb-5">
              <CardTitle className="text-2xl font-bold tracking-tight">Sign In</CardTitle>
              <CardDescription>
                Enter credentials to access your tracking space
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80 font-semibold text-xs tracking-wider uppercase">Email Address</Label>
                  <div className="relative group/input">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground group-focus-within/input:text-primary transition-colors duration-200 pointer-events-none">
                      <Mail className="h-4.5 w-4.5" />
                      <div className="h-4 w-[1px] bg-border/85 ml-2.5"></div>
                    </div>
                    <Input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="h-11 pl-11 border-border/60 bg-background/40 focus-visible:ring-primary/30 focus-visible:border-primary rounded-lg transition-all duration-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground/80 font-semibold text-xs tracking-wider uppercase">Password</Label>
                    <span className="text-xs text-primary/80 hover:text-primary cursor-pointer transition-colors font-medium">Forgot password?</span>
                  </div>
                  <div className="relative group/input">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-muted-foreground group-focus-within/input:text-primary transition-colors duration-200 pointer-events-none">
                      <Lock className="h-4.5 w-4.5" />
                      <div className="h-4 w-[1px] bg-border/85 ml-2.5"></div>
                    </div>
                    <Input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11 pl-11 pr-10 border-border/60 bg-background/40 focus-visible:ring-primary/30 focus-visible:border-primary rounded-lg transition-all duration-200"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none cursor-pointer animate-none"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-11 font-semibold rounded-lg bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/95 hover:to-cyan-500/95 text-primary-foreground shadow-lg hover:shadow-primary/20 hover:shadow-xl active:scale-[0.98] transition-all duration-200 mt-2 relative overflow-hidden group/btn cursor-pointer"
                  disabled={submitting}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 ease-out"></div>
                  {submitting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Authenticating...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      <LogIn className="h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform duration-200" /> Sign In
                    </span>
                  )}
                </Button>
              </form>

              {/* Demo Credentials Quick-Seeder Widget */}
              <div className="mt-5 pt-4 border-t border-border/30">
                <button
                  type="button"
                  onClick={() => setShowSeeder(!showSeeder)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
                    Quick Demo Access
                  </span>
                  {showSeeder ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                
                <AnimatePresence>
                  {showSeeder && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {[
                          { role: "Admin", email: "admin@tradex.com", password: "password123", color: "from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 text-amber-500 dark:text-amber-400 border-amber-500/20" },
                          { role: "Manager", email: "sales@tradex.com", password: "password123", color: "from-sky-500/10 to-indigo-500/10 hover:from-sky-500/20 hover:to-indigo-500/20 text-sky-500 dark:text-sky-400 border-sky-500/20" },
                          { role: "Employee", email: "emp1@tradex.com", password: "password123", color: "from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 text-emerald-500 dark:text-emerald-400 border-emerald-500/20" },
                        ].map((acc) => (
                          <button
                            key={acc.role}
                            type="button"
                            onClick={() => handleSeed(acc)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border bg-gradient-to-b ${acc.color} transition-all duration-200 hover:scale-[1.04] active:scale-95 text-center cursor-pointer`}
                          >
                            <span className="text-[10px] font-bold uppercase tracking-wider mb-0.5">{acc.role}</span>
                            <span className="text-[9px] opacity-75 truncate max-w-full font-mono">{acc.email.split('@')[0]}</span>
                          </button>
                        ))}
                      </div>
                      {seededRole && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center mt-2.5"
                        >
                          <span className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 flex items-center justify-center gap-1">
                            <Check className="h-3 w-3 animate-bounce" /> Auto-filled credentials for {seededRole}!
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  )
}

export default Login
