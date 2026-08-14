import { useAuth } from "../../context/AuthContext"
import { BarChart3 } from "lucide-react"
import ReportsTab from "../../components/dashboards/superadmin/ReportsTab/ReportsTab"

const AdminReportsPage = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-8 w-8 text-primary" />
          Reports & Analytics
        </h2>
        <p className="text-muted-foreground">
          Welcome, <strong className="text-foreground">{user?.name}</strong>. Org-wide performance, capacity, and productivity signals.
        </p>
      </div>

      <ReportsTab />
    </div>
  )
}

export default AdminReportsPage
