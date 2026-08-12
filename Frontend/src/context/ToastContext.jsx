import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"
import { extractErrorMessage } from "../lib/utils"

const ToastContext = createContext(null)

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }, [removeToast])

  // Memoize toast methods for useToast hook
  const toast = useMemo(() => ({
    success: (msg) => addToast(msg, "success"),
    error: (msg) => addToast(msg, "destructive"),
    warning: (msg) => addToast(msg, "warning"),
    info: (msg) => addToast(msg, "info")
  }), [addToast])

  // Central Axios Response Interceptor to catch errors globally
  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        // 401 is handled silently by AuthContext (logout/redirect)
        if (error.response && error.response.status === 401) {
          return Promise.reject(error)
        }

        if (error.response) {
          // Operational error returned by backend globalErrorHandler (e.g. 400, 403, 500)
          toast.error(extractErrorMessage(error))
        } else if (error.request) {
          // Request was made but no response was received (Network connection issue)
          toast.error("Network connection error. Please check your internet connectivity.")
        } else {
          // Request configuration setup failure
          toast.error(error.message || "Request configuration error")
        }

        return Promise.reject(error)
      }
    )

    return () => {
      axios.interceptors.response.eject(interceptorId)
    }
  }, [toast])

  // Set default axios timeout to 15 seconds to prevent infinite loads
  useEffect(() => {
    axios.defaults.timeout = 15000
  }, [])

  // Listen for browser online/offline changes and unhandled promise rejections
  useEffect(() => {
    const handleOnline = () => toast.success("Back online! Connection re-established.")
    const handleOffline = () => toast.warning("Connection lost. Working in offline mode.")
    const handleUnhandledRejection = (event) => {
      if (event.reason) {
        console.error("Unhandled promise rejection caught:", event.reason)
        // Suppress displaying duplicate toasts for intercepted Axios errors
        if (event.reason.isAxiosError) return

        const errorMsg = extractErrorMessage(event.reason)
        toast.error(errorMsg)
      }
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [toast])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Floating Glassmorphic Toasts Overlay */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 max-w-md w-full px-4 sm:px-0 pointer-events-none">
        {toasts.map((t) => {
          let typeColor = "border-primary"
          let Icon = Info
          
          if (t.type === "success") {
            typeColor = "border-emerald-500"
            Icon = CheckCircle2
          } else if (t.type === "destructive") {
            typeColor = "border-rose-500"
            Icon = AlertCircle
          } else if (t.type === "warning") {
            typeColor = "border-amber-500"
            Icon = AlertCircle
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 w-full bg-card/90 dark:bg-card/95 backdrop-blur-md border border-border/80 ${typeColor} border-l-4 shadow-xl p-4 rounded-xl animate-slide-in-right transition-all duration-300`}
            >
              <div className="shrink-0 mt-0.5">
                {t.type === "success" && <Icon className="h-5 w-5 text-emerald-500" />}
                {t.type === "destructive" && <Icon className="h-5 w-5 text-rose-500" />}
                {t.type === "warning" && <Icon className="h-5 w-5 text-amber-500" />}
                {t.type === "info" && <Icon className="h-5 w-5 text-primary" />}
              </div>
              
              <div className="flex-1 text-sm font-semibold text-foreground/90 leading-relaxed pr-2">
                {t.message}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/40 p-1 rounded-md transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context.toast
}

export default ToastContext
