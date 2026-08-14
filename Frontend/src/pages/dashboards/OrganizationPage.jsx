import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Building2, Users, UserPlus, Repeat, Network } from "lucide-react"
import DepartmentsTab from "../../components/dashboards/superadmin/DepartmentsTab"
import TeamsTab from "../../components/dashboards/superadmin/TeamsTab"
import UsersTab from "../../components/dashboards/superadmin/UsersTab/UsersTab"
import TaskTemplatesTab from "../../components/dashboards/superadmin/TaskTemplatesTab"

// Org-structure configuration, split out of the Admin Panel: Departments/Teams/Users/
// Task Templates are set-up-once config screens with a different cadence than the
// Overview command center, so they live on their own sidebar page.
const OrganizationPage = () => {
  const [activeTab, setActiveTab] = useState("departments")

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
          <Network className="h-8 w-8 text-primary" />
          Organization
        </h2>
        <p className="text-muted-foreground">Manage departments, teams, user assignments, and task templates.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="flex w-full max-w-[600px] border-b border-border bg-transparent p-0 rounded-none h-12 gap-6 overflow-x-auto">
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
      </Tabs>
    </div>
  )
}

export default OrganizationPage
