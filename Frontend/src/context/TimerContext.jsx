import { createContext, useContext, useState, useEffect, useRef } from "react"
import axios from "axios"
import { useAuth } from "./AuthContext"
import API_BASE from "../lib/api"

const TimerContext = createContext(null)

export const TimerProvider = ({ children }) => {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const timerRef = useRef(null)

  const fetchActiveSession = async () => {
    if (!user || user.role !== "employee") {
      setActiveSession(null)
      setElapsedSeconds(0)
      setIsRunning(false)
      return
    }
    try {
      const res = await axios.get(`${API_BASE}/api/work-sessions/active`)
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
    } catch (err) {
      console.error("Error fetching active timer:", err)
    }
  }

  // Fetch active session when user logs in or role changes
  useEffect(() => {
    fetchActiveSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [user])

  // Timer interval handling
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning])

  const startTimer = async (taskId) => {
    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/start`, { taskId })
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
      return { success: true }
    } catch (err) {
      console.error("Error starting timer:", err)
      return { success: false, error: err.response?.data?.error || "Error starting timer" }
    }
  }

  const pauseTimer = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/pause`)
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
    } catch (err) {
      console.error("Error pausing timer:", err)
    }
  }

  const resumeTimer = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/resume`)
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
    } catch (err) {
      console.error("Error resuming timer:", err)
    }
  }

  const stopTimer = async () => {
    try {
      await axios.post(`${API_BASE}/api/work-sessions/stop`)
      setActiveSession(null)
      setElapsedSeconds(0)
      setIsRunning(false)
    } catch (err) {
      console.error("Error stopping timer:", err)
    }
  }

  return (
    <TimerContext.Provider value={{
      activeSession,
      elapsedSeconds,
      isRunning,
      startTimer,
      pauseTimer,
      resumeTimer,
      stopTimer,
      refreshTimer: fetchActiveSession
    }}>
      {children}
    </TimerContext.Provider>
  )
}

export const useTimer = () => {
  const context = useContext(TimerContext)
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider")
  }
  return context
}
export default TimerContext
