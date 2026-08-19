import TaskDetailModalCore from "./TaskDetailModalCore"
import ApprovalGatingPanel from "./ApprovalGatingPanel"
import TaskAdminPanel from "./TaskAdminPanel"
import BlockedPanel from "./BlockedPanel"

// Manager's entry point into the shared Task Detail dialog. Only exposes the props a
// manager actually needs — no employee-only `handleStatusTransition` in this surface.
//
// Two action panels share the `actionPanel` slot; each self-gates on task status, so
// in practice only the relevant one renders (approval on In Review, admin actions on
// anything not Completed). `onEdit`/`onCancel` are optional — a caller that doesn't
// pass them simply doesn't get the admin panel.
const ManagerTaskDetailModal = ({
  detailTask, setDetailTask, updateTaskStatus, submitting, onCommentPosted, onEdit, onCancel, onToggleBlocked
}) => (
  <TaskDetailModalCore
    role="manager"
    detailTask={detailTask}
    setDetailTask={setDetailTask}
    submitting={submitting}
    onCommentPosted={onCommentPosted}
    actionPanel={detailTask && (
      <>
        <ApprovalGatingPanel detailTask={detailTask} submitting={submitting} updateTaskStatus={updateTaskStatus} />
        <BlockedPanel detailTask={detailTask} submitting={submitting} onToggleBlocked={onToggleBlocked} />
        {onEdit && onCancel && (
          <TaskAdminPanel detailTask={detailTask} submitting={submitting} onEdit={onEdit} onCancel={onCancel} />
        )}
      </>
    )}
  />
)

export default ManagerTaskDetailModal
