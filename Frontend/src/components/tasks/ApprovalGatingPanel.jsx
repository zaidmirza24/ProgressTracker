import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserCheck } from "lucide-react"

// Manager-only: approve or send back for rework. Self-contained — decides on its own
// whether there's anything to show, so the shell doesn't need to know the status rule.
const ApprovalGatingPanel = ({ detailTask, submitting, updateTaskStatus }) => {
  const [reviewComment, setReviewComment] = useState("")

  if (detailTask.status !== "In Review") return null

  const handleReview = async (status) => {
    const result = await updateTaskStatus(detailTask._id, status, reviewComment)
    if (result.success) setReviewComment("")
  }

  return (
    <div className="space-y-3.5 p-4 rounded-xl border border-warning/30 bg-warning/5">
      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
        <UserCheck className="h-4 w-4 text-warning" />
        Work Awaiting Review
      </h4>
      <div className="space-y-1.5">
        <Label htmlFor="review-comm" className="text-xs text-muted-foreground">Review Feedback Comments (required)</Label>
        <Input
          id="review-comm"
          placeholder="Add design review notes, request fixes, or log acceptance..."
          value={reviewComment}
          onChange={e => setReviewComment(e.target.value)}
          className="h-9 rounded-lg"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button
          size="sm"
          variant="destructive"
          className="rounded-lg font-semibold"
          onClick={() => handleReview("In Progress")}
          disabled={submitting || !reviewComment.trim()}
        >
          Send for Rework
        </Button>
        <Button
          size="sm"
          className="rounded-lg font-semibold shadow"
          onClick={() => handleReview("Completed")}
          disabled={submitting || !reviewComment.trim()}
        >
          Approve Work
        </Button>
      </div>
    </div>
  )
}

export default ApprovalGatingPanel
