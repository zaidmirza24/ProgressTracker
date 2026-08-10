import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { motion } from "motion/react"
import { LogIn, Loader2, BarChart3, Activity, ShieldCheck, Clock } from "lucide-react"

const Login = () => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  
  const { user, login } = useAuth()
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

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-background overflow-hidden">
      
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
        <div className="absolute top-[-10%] right-[-10%] h-[40%] w-[40%] bg-primary/5 rounded-full blur-3xl lg:hidden"></div>
        <div className="absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] bg-violet-500/5 rounded-full blur-3xl lg:hidden"></div>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[400px]"
        >
          {/* Logo on mobile only */}
          <div className="flex items-center gap-2 justify-center mb-8 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-violet-500 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              ProgressTracker
            </span>
          </div>

          <Card className="border-border/40 shadow-2xl bg-card/60 backdrop-blur-md">
            <CardHeader className="space-y-1.5 pb-6">
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
                  <Label htmlFor="email" className="text-foreground/80 font-medium">Email Address</Label>
                  <Input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="h-10 border-border/60 focus-visible:ring-primary focus-visible:border-primary rounded-lg"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-foreground/80 font-medium">Password</Label>
                    <span className="text-xs text-primary/80 hover:text-primary cursor-pointer transition-colors">Forgot password?</span>
                  </div>
                  <Input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 border-border/60 focus-visible:ring-primary focus-visible:border-primary rounded-lg"
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-10 font-semibold rounded-lg bg-primary hover:bg-primary/90 shadow-md glow-primary transition-all duration-200 mt-2" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 justify-center">
                      <LogIn className="h-4 w-4" /> Sign In
                    </span>
                  )}
                </Button>
              </form>

              {/* Sample credentials helper for testing/admin */}
              <div className="mt-6 pt-6 border-t border-border/40 text-center">
                <span className="text-[11px] text-muted-foreground">
                  Seeded org credentials can be found in `seed.js`
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

    </div>
  )
}

export default Login
