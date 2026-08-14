import { useAuth } from "../../context/AuthContext"
import TeamCommandCenter from "../../components/dashboards/shared/TeamCommandCenter"

const ManagerDashboard = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight text-foreground">Manager Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome back, <strong className="text-foreground">{user?.name}</strong>. Monitor team progress, assign tasks, and review submissions.
        </p>
      </div>

      <TeamCommandCenter />
    </div>
  )
}

export default ManagerDashboard
