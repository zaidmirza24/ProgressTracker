import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShieldAlert } from "lucide-react"
import { motion } from "motion/react"

const Unauthorized = () => {
  const { user } = useAuth()

  // Determine standard redirection dashboard path
  let redirectPath = "/login"
  if (user) {
    if (user.role === "super_admin") redirectPath = "/super-admin"
    else if (user.role === "manager") redirectPath = "/manager"
    else if (user.role === "employee") redirectPath = "/employee"
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-destructive/20 shadow-lg text-center bg-card">
          <CardHeader className="space-y-3">
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ delay: 0.2, duration: 0.5, ease: "easeInOut" }}
              className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive"
            >
              <ShieldAlert className="h-6 w-6" />
            </motion.div>
            <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
            <CardDescription>
              You do not have the required permissions to view this resource.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <Link to={redirectPath}>
              <Button variant="default" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default Unauthorized
