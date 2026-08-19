import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { TimerProvider } from "./context/TimerContext"
import { ThemeProvider } from "./context/ThemeContext"
import ErrorBoundary from "./components/ErrorBoundary"
import { ToastProvider } from "./context/ToastContext"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import Login from "./pages/Login"
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard"
import AdminReportsPage from "./pages/dashboards/AdminReportsPage"
import TeamTasksPage from "./pages/dashboards/TeamTasksPage"
import OrganizationPage from "./pages/dashboards/OrganizationPage"
import ManagerDashboard from "./pages/dashboards/ManagerDashboard"
import MyWorkPage from "./pages/dashboards/MyWorkPage"
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard"
import Unauthorized from "./pages/dashboards/Unauthorized"
import WorkLogs from "./pages/WorkLogs"
import MyProgress from "./pages/MyProgress"

// HomeRedirect routes authenticated users to their correct dashboard
const HomeRedirect = () => {
  const { user } = useAuth()
  
  if (!user) return <Navigate to="/login" replace />
  if (user.role === "super_admin") return <Navigate to="/super-admin" replace />
  if (user.role === "manager") return <Navigate to="/manager" replace />
  return <Navigate to="/employee" replace />
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          {/* Protected Shell Routes */}
          <Route element={<ProtectedRoute><TimerProvider><Layout /></TimerProvider></ProtectedRoute>}>
            <Route path="/" element={<HomeRedirect />} />
            
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/super-admin/reports"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <AdminReportsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/super-admin/organization"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <OrganizationPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={["manager"]}>
                  <ManagerDashboard />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/my-work"
              element={
                <ProtectedRoute allowedRoles={["manager", "super_admin"]}>
                  <MyWorkPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/team-tasks"
              element={
                <ProtectedRoute allowedRoles={["manager", "super_admin"]}>
                  <TeamTasksPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/employee"
              element={
                <ProtectedRoute allowedRoles={["employee"]}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-progress"
              element={
                <ProtectedRoute allowedRoles={["employee", "manager", "super_admin"]}>
                  <MyProgress />
                </ProtectedRoute>
              }
            />

            <Route
              path="/work-logs"
              element={
                <ProtectedRoute allowedRoles={["employee", "manager", "super_admin"]}>
                  <WorkLogs />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
