import { useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { Shield } from "lucide-react"
import OrgPulseStrip from "../../components/dashboards/superadmin/OrgPulseStrip"
import TeamCommandCenter from "../../components/dashboards/shared/TeamCommandCenter"

// Organization-wide surface only — the Super Admin's own work now lives on its own
// sidebar page ("My Work", see MyWorkPage.jsx) rather than a tab here.
const SuperAdminDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Super Admin Center
        </h2>
        <p className="text-muted-foreground">
          Welcome, <strong className="text-foreground">{user?.name}</strong>. Monitor org-wide task activity and team performance.
        </p>
      </div>

      {/* Org Pulse — one-glance health check */}
      <OrgPulseStrip onViewReports={() => navigate("/super-admin/reports")} />

      <TeamCommandCenter />
    </div>
  )
}

export default SuperAdminDashboard
