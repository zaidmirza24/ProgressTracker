import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { TimerProvider } from "./context/TimerContext"
import Layout from "./components/Layout"
import ProtectedRoute from "./components/ProtectedRoute"
import Login from "./pages/Login"
import SuperAdminDashboard from "./pages/dashboards/SuperAdminDashboard"
import ManagerDashboard from "./pages/dashboards/ManagerDashboard"
import EmployeeDashboard from "./pages/dashboards/EmployeeDashboard"
import Unauthorized from "./pages/dashboards/Unauthorized"
import WorkLogs from "./pages/WorkLogs"

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
              path="/manager"
              element={
                <ProtectedRoute allowedRoles={["manager"]}>
                  <ManagerDashboard />
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
  )
}

export default App
