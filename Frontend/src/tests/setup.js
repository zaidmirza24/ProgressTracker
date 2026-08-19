import { afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"

// Runs before every frontend test file.

afterEach(() => {
  // Unmount anything still rendered, so a component's effects and intervals cannot
  // outlive its test. TimerContext ticks on a 1s interval — without this, a leaked
  // provider keeps firing state updates into a torn-down tree.
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

// ─── jsdom gaps ───────────────────────────────────────────────────────────────
// jsdom implements no layout engine, so these browser APIs are simply absent. Radix
// primitives and the theme/timer contexts call them during render; without stubs the
// failure surfaces as an unrelated "not a function" deep inside a component.

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  })
}

class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
}

globalThis.ResizeObserver ??= MockObserver
globalThis.IntersectionObserver ??= MockObserver

Element.prototype.scrollIntoView ??= vi.fn()
Element.prototype.hasPointerCapture ??= vi.fn(() => false)
Element.prototype.setPointerCapture ??= vi.fn()
Element.prototype.releasePointerCapture ??= vi.fn()
