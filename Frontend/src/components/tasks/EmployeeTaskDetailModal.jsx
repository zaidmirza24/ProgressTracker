import TaskDetailModalCore from "./TaskDetailModalCore"
import TaskTimerPanel from "./TaskTimerPanel"

// Employee's entry point into the shared Task Detail dialog. Only exposes the props an
// employee actually needs — no manager-only `updateTaskStatus` in this surface.
const EmployeeTaskDetailModal = ({ detailTask, setDetailTask, handleStatusTransition, submitting, onCommentPosted }) => (
  <TaskDetailModalCore
    role="employee"
    detailTask={detailTask}
    setDetailTask={setDetailTask}
    submitting={submitting}
    onCommentPosted={onCommentPosted}
    onStepClick={(stepKey) => handleStatusTransition(stepKey)}
    actionPanel={detailTask && <TaskTimerPanel detailTask={detailTask} />}
  />
)

export default EmployeeTaskDetailModal
