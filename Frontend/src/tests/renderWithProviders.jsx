import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ThemeProvider } from "../context/ThemeContext"
import { ToastProvider } from "../context/ToastContext"

// Renders a component inside the providers it actually needs.
//
// Providers are opt-in rather than all-on: AuthProvider fetches /api/auth/me on mount
// and TimerProvider starts a 1s interval, so mounting them unconditionally would make
// every unrelated test depend on the axios mock being routed for them.
//
//   renderWithProviders(<Thing />)                        // theme + toast + router
//   renderWithProviders(<Thing />, { route: "/employee" })
//   renderWithProviders(<Thing />, { withToast: false })

export const renderWithProviders = (
  ui,
  { route = "/", withRouter = true, withTheme = true, withToast = true, ...options } = {}
) => {
  const Wrapper = ({ children }) => {
    let tree = children
    if (withToast) tree = <ToastProvider>{tree}</ToastProvider>
    if (withTheme) tree = <ThemeProvider>{tree}</ThemeProvider>
    if (withRouter) tree = <MemoryRouter initialEntries={[route]}>{tree}</MemoryRouter>
    return tree
  }

  return render(ui, { wrapper: Wrapper, ...options })
}

export * from "@testing-library/react"
