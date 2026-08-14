// Deterministic person → color mapping (Linear/GitHub/Notion-style) so the same
// person's avatar reads as the same color everywhere in the app, instead of every
// initials-circle rendering in the same flat gray/primary tint. Reds/roses are
// deliberately excluded — this app reserves red for destructive/overdue signals
// (Rule #38), so an avatar color should never look like an error state.
const AVATAR_PALETTE = [
  { bg: "bg-violet-500/15", border: "border-violet-500/30", text: "text-violet-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/30", text: "text-cyan-400" },
  { bg: "bg-green-500/15", border: "border-green-500/30", text: "text-green-400" },
  { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-500" },
  { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/30", text: "text-fuchsia-400" },
  { bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-400" },
  { bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400" },
]

// Small stable string hash (djb2-ish) — same seed always maps to the same palette
// entry, across sessions and across every component that renders that person.
const hashSeed = (seed) => {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export const getAvatarColorClasses = (seed) => {
  const entry = AVATAR_PALETTE[hashSeed(String(seed || "?")) % AVATAR_PALETTE.length]
  return `${entry.bg} ${entry.border} ${entry.text}`
}
