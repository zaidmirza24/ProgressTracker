import TaskFormModal from "./TaskFormModal"
import CancelTaskDialog from "./CancelTaskDialog"
import ReassignDialog from "./ReassignDialog"

// The three dialogs every manager/admin task surface needs, rendered once per shell.
// Pair with useTaskActions: `<TaskActionDialogs {...dialogProps} />`.
//
// Both confirmation dialogs are keyed on their target's id so their internal state
// (cancel reason, reassign selection) resets between tasks without a reset effect.
const TaskActionDialogs = ({
  user,
  createOpen, setCreateOpen,
  taskForm, setTaskForm,
  customCategoryActive, setCustomCategoryActive,
  submitting, setSubmitting,
  formMode, editTask, onSave,
  cancelTarget, setCancelTarget, onCancelConfirm,
  reassignTarget, setReassignTarget, onReassignConfirm
}) => (
  <>
    {/* Create / Edit — one form, two modes */}
    <TaskFormModal
      createOpen={createOpen}
      setCreateOpen={setCreateOpen}
      taskForm={taskForm}
      setTaskForm={setTaskForm}
      customCategoryActive={customCategoryActive}
      setCustomCategoryActive={setCustomCategoryActive}
      submitting={submitting}
      setSubmitting={setSubmitting}
      user={user}
      mode={formMode}
      editTask={editTask}
      onSave={onSave}
    />

    {/* Cancel (soft-delete) confirmation */}
    <CancelTaskDialog
      key={`cancel-${cancelTarget?._id}`}
      task={cancelTarget}
      open={cancelTarget !== null}
      onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
      onConfirm={onCancelConfirm}
      submitting={submitting}
    />

    {/* Reassign — capacity-aware picker */}
    <ReassignDialog
      key={`reassign-${reassignTarget?._id}`}
      task={reassignTarget}
      open={reassignTarget !== null}
      onOpenChange={(open) => { if (!open) setReassignTarget(null) }}
      onConfirm={onReassignConfirm}
      submitting={submitting}
    />
  </>
)

export default TaskActionDialogs
