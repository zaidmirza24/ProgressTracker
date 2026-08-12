import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { useAuth } from "./AuthContext"
import API_BASE from "../lib/api"

const TimerContext = createContext(null)

export const TimerProvider = ({ children }) => {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  // isPending: true while a timer action is in-flight (for subtle UI feedback)
  const [isPending, setIsPending] = useState(false)
  const timerRef = useRef(null)

  const fetchActiveSession = useCallback(async () => {
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
  }, [user])

  useEffect(() => {
    fetchActiveSession()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchActiveSession])

  // Tick every second when running
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning])

  // ─── Optimistic Start ──────────────────────────────────────────────────────
  // Immediately marks the timer as running with a placeholder session so the
  // clock starts ticking at once. Replaces with real server data on success,
  // or rolls back to the snapshot on failure.
  const startTimer = useCallback(async (taskId) => {
    // Snapshot for rollback
    const prevSession = activeSession
    const prevElapsed = elapsedSeconds
    const prevRunning = isRunning

    // Optimistic update: create a lightweight placeholder session object
    const optimisticSession = {
      _id: "__optimistic__",
      task: { _id: taskId, title: "Starting…", category: "" },
      employee: user?.id,
      startedAt: new Date().toISOString(),
      events: [],
      stoppedAt: null,
      totalSeconds: 0
    }
    setActiveSession(optimisticSession)
    setElapsedSeconds(0)
    setIsRunning(true)
    setIsPending(true)

    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/start`, { taskId })
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      // Reconcile with real server state
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
      return { success: true }
    } catch (err) {
      // Rollback
      setActiveSession(prevSession)
      setElapsedSeconds(prevElapsed)
      setIsRunning(prevRunning)
      console.error("Error starting timer:", err)
      return { success: false, error: err.response?.data?.error || "Error starting timer" }
    } finally {
      setIsPending(false)
    }
  }, [activeSession, elapsedSeconds, isRunning, user])

  // ─── Optimistic Pause ──────────────────────────────────────────────────────
  const pauseTimer = useCallback(async () => {
    const prevSession = activeSession
    const prevElapsed = elapsedSeconds
    const prevRunning = isRunning

    // Optimistic: stop the local tick immediately
    setIsRunning(false)
    setIsPending(true)

    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/pause`)
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
    } catch (err) {
      if (err.response?.status === 404) {
        setActiveSession(null)
        setElapsedSeconds(0)
        setIsRunning(false)
      } else {
        setActiveSession(prevSession)
        setElapsedSeconds(prevElapsed)
        setIsRunning(prevRunning)
      }
      console.error("Error pausing timer:", err)
    } finally {
      setIsPending(false)
    }
  }, [activeSession, elapsedSeconds, isRunning])

  // ─── Optimistic Resume ─────────────────────────────────────────────────────
  const resumeTimer = useCallback(async () => {
    const prevSession = activeSession
    const prevElapsed = elapsedSeconds
    const prevRunning = isRunning

    // Optimistic: resume the local tick immediately
    setIsRunning(true)
    setIsPending(true)

    try {
      const res = await axios.post(`${API_BASE}/api/work-sessions/resume`)
      const { session, elapsedSeconds: serverSeconds, isRunning: serverRunning } = res.data
      setActiveSession(session)
      setElapsedSeconds(serverSeconds)
      setIsRunning(serverRunning)
    } catch (err) {
      if (err.response?.status === 404) {
        setActiveSession(null)
        setElapsedSeconds(0)
        setIsRunning(false)
      } else {
        setActiveSession(prevSession)
        setElapsedSeconds(prevElapsed)
        setIsRunning(prevRunning)
      }
      console.error("Error resuming timer:", err)
    } finally {
      setIsPending(false)
    }
  }, [activeSession, elapsedSeconds, isRunning])

  // ─── Optimistic Stop ───────────────────────────────────────────────────────
  const stopTimer = useCallback(async () => {
    const prevSession = activeSession
    const prevElapsed = elapsedSeconds
    const prevRunning = isRunning

    // Optimistic: clear timer immediately
    setActiveSession(null)
    setElapsedSeconds(0)
    setIsRunning(false)
    setIsPending(true)

    try {
      await axios.post(`${API_BASE}/api/work-sessions/stop`)
    } catch (err) {
      if (err.response?.status === 404) {
        setActiveSession(null)
        setElapsedSeconds(0)
        setIsRunning(false)
      } else {
        setActiveSession(prevSession)
        setElapsedSeconds(prevElapsed)
        setIsRunning(prevRunning)
      }
      console.error("Error stopping timer:", err)
    } finally {
      setIsPending(false)
    }
  }, [activeSession, elapsedSeconds, isRunning])

  return (
    <TimerContext.Provider value={{
      activeSession,
      elapsedSeconds,
      isRunning,
      isPending,
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
