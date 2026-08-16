import TaskDetailModalCore from "./TaskDetailModalCore"
import TaskTimerPanel from "./TaskTimerPanel"
import BlockedPanel from "./BlockedPanel"

// Employee's entry point into the shared Task Detail dialog. Only exposes the props an
// employee actually needs — no manager-only `updateTaskStatus` in this surface.
const EmployeeTaskDetailModal = ({ detailTask, setDetailTask, handleStatusTransition, submitting, onCommentPosted, onToggleBlocked }) => (
  <TaskDetailModalCore
    role="employee"
    detailTask={detailTask}
    setDetailTask={setDetailTask}
    submitting={submitting}
    onCommentPosted={onCommentPosted}
    onStepClick={(stepKey) => handleStatusTransition(stepKey)}
    actionPanel={detailTask && (
      <>
        <TaskTimerPanel detailTask={detailTask} />
        <BlockedPanel detailTask={detailTask} submitting={submitting} onToggleBlocked={onToggleBlocked} />
      </>
    )}
  />
)

export default EmployeeTaskDetailModal
