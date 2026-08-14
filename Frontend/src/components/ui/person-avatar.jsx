import { Avatar, AvatarFallback } from "./avatar"
import { getAvatarColorClasses } from "../../lib/avatarColor"
import { getInitials } from "../../lib/taskFormatters"
import { cn } from "@/lib/utils"

// Initials avatar with a deterministic per-person color (hashed from `seed`, falling
// back to `name`) — replaces the flat gray/primary-tint circles used everywhere a
// person's initials are shown, so the same person is recognizable at a glance across
// the whole app. Pass sizing/text-size via `className` (e.g. "h-7 w-7 text-[10px]").
const PersonAvatar = ({ name, seed, fallback = "?", className }) => (
  <Avatar className={cn("border h-7 w-7 shrink-0", className)}>
    <AvatarFallback className={cn("font-bold", getAvatarColorClasses(seed || name || fallback))}>
      {getInitials(name, fallback)}
    </AvatarFallback>
  </Avatar>
)

export default PersonAvatar
