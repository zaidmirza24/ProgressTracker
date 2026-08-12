import { createContext, useContext, useState, useEffect } from "react"
import axios from "axios"
import API_BASE from "../lib/api"
import { extractErrorMessage } from "../lib/utils"

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem("token") || null)
  const [loading, setLoading] = useState(true)

  // Configure axios authorization header on mount or token change
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
      // Verify token on server
      axios.get(`${API_BASE}/api/auth/me`)
        .then(res => {
          setUser(res.data.user)
          setLoading(false)
        })
        .catch(err => {
          console.error("Token verification failed, logging out:", err)
          logout()
          setLoading(false)
        })
    } else {
      delete axios.defaults.headers.common["Authorization"]
      setUser(null)
      setLoading(false)
    }
  }, [token])

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { email, password })
      const { token: newToken, user: newUser } = res.data
      localStorage.setItem("token", newToken)
      setToken(newToken)
      setUser(newUser)
      return { success: true }
    } catch (err) {
      const errorMessage = extractErrorMessage(err, "Login failed. Please check credentials.")
      return { success: false, error: errorMessage }
    }
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
export default AuthContext
