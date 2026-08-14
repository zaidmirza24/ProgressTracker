import TaskDetailModalCore from "./TaskDetailModalCore"
import ApprovalGatingPanel from "./ApprovalGatingPanel"

// Manager's entry point into the shared Task Detail dialog. Only exposes the props a
// manager actually needs — no employee-only `handleStatusTransition` in this surface.
const ManagerTaskDetailModal = ({ detailTask, setDetailTask, updateTaskStatus, submitting, onCommentPosted }) => (
  <TaskDetailModalCore
    role="manager"
    detailTask={detailTask}
    setDetailTask={setDetailTask}
    submitting={submitting}
    onCommentPosted={onCommentPosted}
    actionPanel={detailTask && (
      <ApprovalGatingPanel detailTask={detailTask} submitting={submitting} updateTaskStatus={updateTaskStatus} />
    )}
  />
)

export default ManagerTaskDetailModal
