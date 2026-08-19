import { cn } from "@/lib/utils"

// Every task/person/log row in the app opens its detail modal from an `onClick` on a
// <tr> or <div> — which no keyboard or screen-reader user can reach. This makes the
// row's TITLE a real button so that path exists.
//
// Why the title rather than `role="button" tabIndex={0}` on the row itself:
//   - On a <tr>, role="button" replaces the row/cell semantics a screen-reader user
//     navigates a table by. The row stops being a row.
//   - Rows and cards already contain their own controls (status select, timer
//     buttons, action menu). Nesting those inside a button is invalid, and makes the
//     outer element's accessible name the concatenation of everything in it.
//   - The title is the accessible name a user actually wants announced
//     ("Fix login bug, button"), and it's where a sighted user aims anyway.
//
// The container keeps its own onClick, so mouse users can still click anywhere in the
// row. `stopPropagation` prevents that handler firing twice on a title click.
//
// Wrap only the title TEXT, not its trailing badges — otherwise the accessible name
// becomes "Fix login bug Self Daily Carried from Aug 12 Blocked".
const OpenDetailButton = ({ onOpen, className, children }) => (
  <button
    type="button"
    onClick={e => { e.stopPropagation(); onOpen() }}
    className={cn(
      "text-left bg-transparent p-0 m-0 cursor-pointer rounded-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
      className
    )}
  >
    {children}
  </button>
)

export default OpenDetailButton
