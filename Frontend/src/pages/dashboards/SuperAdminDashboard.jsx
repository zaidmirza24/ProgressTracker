import { useAuth } from "../../context/AuthContext"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Users, UserPlus, Shield, BarChart3, Repeat } from "lucide-react"
import DepartmentsTab from "../../components/dashboards/superadmin/DepartmentsTab"
import TeamsTab from "../../components/dashboards/superadmin/TeamsTab"
import UsersTab from "../../components/dashboards/superadmin/UsersTab/UsersTab"
import TaskTemplatesTab from "../../components/dashboards/superadmin/TaskTemplatesTab"
import ReportsTab from "../../components/dashboards/superadmin/ReportsTab/ReportsTab"

// ─── Super Admin Dashboard ───────────────────────────────────────────────────
const SuperAdminDashboard = () => {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8 text-primary" />
          Super Admin Center
        </h2>
        <p className="text-muted-foreground">
          Welcome, <strong className="text-foreground">{user?.name}</strong>. Manage departments, teams, and user assignments.
        </p>
      </div>

      <Tabs defaultValue="departments" className="w-full space-y-6">
        <TabsList className="flex w-full max-w-[720px] border-b border-border bg-transparent p-0 rounded-none h-12 gap-6 overflow-x-auto">
          <TabsTrigger
            value="departments"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Building2 className="h-4 w-4" /> Departments
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Users className="h-4 w-4" /> Teams
          </TabsTrigger>
          <TabsTrigger
            value="users"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger
            value="task-templates"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <Repeat className="h-4 w-4" /> Task Templates
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="flex items-center gap-1.5 px-1 pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary text-sm font-semibold tracking-tight text-muted-foreground whitespace-nowrap"
          >
            <BarChart3 className="h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <DepartmentsTab />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="task-templates">
          <TaskTemplatesTab />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default SuperAdminDashboard
