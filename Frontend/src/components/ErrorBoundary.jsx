import React from "react"
import { AlertCircle, RefreshCw } from "lucide-react"

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an exception 💥:", error, errorInfo)
  }

  handleReload = () => {
    // Clear potentially corrupted workspace states and reload page
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#001B1F] text-foreground p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-primary)/8%,transparent_45%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--color-primary)/5%,transparent_40%)] pointer-events-none" />
          
          <div className="max-w-lg w-full bg-[#01252a]/70 border border-border/40 backdrop-blur-md rounded-2xl shadow-2xl p-8 space-y-6 text-center z-10">
            <div className="mx-auto h-16 w-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
              <AlertCircle className="h-8 w-8" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Oops, Something Went Wrong!
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The application encountered an unexpected runtime error. We have logged the incident and you can try reloading below.
              </p>
            </div>

            {/* Collapsible Technical Details for debugging */}
            <details className="text-left bg-muted/40 p-4 rounded-xl border border-border/30 text-xs font-mono max-h-[220px] overflow-auto select-text cursor-pointer">
              <summary className="font-bold text-muted-foreground hover:text-foreground transition-colors pb-1">
                Technical Exception Details
              </summary>
              <div className="mt-2 text-rose-400 font-semibold whitespace-pre-wrap break-all">
                {this.state.error && this.state.error.toString()}
              </div>
              <div className="mt-2 text-muted-foreground whitespace-pre-wrap leading-relaxed opacity-60">
                {this.state.error && this.state.error.stack}
              </div>
            </details>

            <div className="pt-2">
              <button
                onClick={this.handleReload}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md glow-primary cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
