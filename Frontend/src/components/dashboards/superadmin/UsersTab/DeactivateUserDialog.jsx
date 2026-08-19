import { useState } from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import PersonAvatar from "@/components/ui/person-avatar"
import { UserMinus, AlertTriangle, Info } from "lucide-react"
import { useToast } from "../../../../context/ToastContext"
import useOrgStore from "../../../../store/useOrgStore"

// Soft-delete a person (Core Rule 2 — never hard-delete). The whole point of this
// dialog is the handover: someone leaving with open work would otherwise strand it —
// invisible in every list, since they drop out of the employee set, but still counted
// in org-wide totals. The server refuses the deactivation without a target.
const DeactivateUserDialog = ({ user, open, onOpenChange, openTaskCount = 0 }) => {
  const users = useOrgStore(s => s.users)
  const deactivateUser = useOrgStore(s => s.deactivateUser)
  const toast = useToast()

  const [reassignTo, setReassignTo] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null

  const candidates = users.filter(u => u.isActive && u._id !== user._id && u.role === "employee")
  const needsHandover = openTaskCount > 0
  const canSubmit = !needsHandover || Boolean(reassignTo)

  const handleConfirm = async () => {
    setSubmitting(true)
    const result = await deactivateUser(user._id, reassignTo || null)
    setSubmitting(false)
    if (result.success) {
      const bits = []
      if (result.reassignedTasks) bits.push(`${result.reassignedTasks} task${result.reassignedTasks === 1 ? "" : "s"} handed over`)
      if (result.cancelledDailyTasks) bits.push(`${result.cancelledDailyTasks} daily task${result.cancelledDailyTasks === 1 ? "" : "s"} closed`)
      if (result.orphanedReports) bits.push(`${result.orphanedReports} report${result.orphanedReports === 1 ? "" : "s"} left without a manager`)
      toast.success(`${user.name} deactivated${bits.length ? ` — ${bits.join(", ")}` : ""}.`)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] border-border/60">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserMinus className="h-4.5 w-4.5 text-destructive" />
            Deactivate this person?
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <PersonAvatar name={user.name} seed={user._id} fallback="U" className="h-5 w-5 text-[9px]" />
            <span className="font-semibold text-foreground">{user.name}</span>
            <span className="text-muted-foreground">· {user.role.replace("_", " ")}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          <div className="text-xs text-muted-foreground bg-muted/20 border border-border/30 rounded-lg p-3 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              They can no longer sign in and drop out of every list, report and capacity
              calculation. Nothing is deleted — their completed work, time logs and history
              are all kept.
            </span>
          </div>

          {needsHandover ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-400 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  {user.name} has {openTaskCount} open task{openTaskCount === 1 ? "" : "s"}. Choose who
                  takes them over — they'll move across with their history and tracked time intact.
                </span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-foreground/80 font-medium text-xs">Hand tasks over to</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger className="h-9 rounded-lg text-sm">
                    <SelectValue placeholder="— Select a team member —" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map(c => (
                      <SelectItem key={c._id} value={c._id}>
                        <span className="flex items-center gap-2">
                          <PersonAvatar name={c.name} seed={c._id} fallback="EM" className="h-4 w-4 text-[8px]" />
                          {c.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {candidates.length === 0 && (
                  <p className="text-[11px] text-destructive font-medium">
                    There's nobody else active to hand these tasks to.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No open tasks — nothing needs handing over.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" className="rounded-lg h-9" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep active
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-lg h-9 font-semibold"
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
          >
            {submitting ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default DeactivateUserDialog
