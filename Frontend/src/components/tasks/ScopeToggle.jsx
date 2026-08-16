import { TASK_SCOPES, SCOPE_LABELS } from "../../lib/taskScope"

// Today / This week / All time. Matches the existing Board|List switch's visual
// treatment so it reads as the same kind of control rather than a new pattern (§37).
const ScopeToggle = ({ scope, onChange, className = "" }) => (
  <div
    role="group"
    aria-label="Task timeframe"
    className={`flex items-center bg-muted/60 p-1 rounded-lg border border-border/40 shrink-0 ${className}`}
  >
    {TASK_SCOPES.map(value => {
      const active = scope === value
      return (
        <button
          key={value}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(value)}
          className={`h-7 px-2.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
            active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {SCOPE_LABELS[value]}
        </button>
      )
    })}
  </div>
)

export default ScopeToggle
