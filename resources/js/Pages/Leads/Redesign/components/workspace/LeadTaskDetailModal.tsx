import { useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import type { Task } from "@/Types/api/tasks";
import TaskDetailModal from "@/Components/Redesign/modals/TaskDetailModal";
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";
import useLeadTaskStatus from "../../hooks/useLeadTaskStatus";
import useLeadTaskUpdate from "../../hooks/useLeadTaskUpdate";

interface LeadTaskDetailModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    permissions?: Record<string, string>;
    onClose: () => void;
}

function canWriteTask(
    task: Task,
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return true;
    const edit = permissions.edit_tasks;
    if (edit === "all") return true;
    if (edit === "added") return task.added_by === userId;
    if (edit === "none") return false;
    // Unknown / unset permission strings — allow write (matches TasksTab bulk defaults).
    return true;
}

export default function LeadTaskDetailModal({
    task,
    taskBoardColumns,
    permissions,
    onClose,
}: LeadTaskDetailModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const [deleteOpen, setDeleteOpen] = useState(false);
    const { setStatus, isPending } = useLeadTaskStatus();
    const { setTasks } = useLeadWorkspace();
    const { updateTask, isUpdating, errors, clearErrors } = useLeadTaskUpdate(
        task ?? ({ id: 0 } as Task),
    );

    const canWrite = task
        ? canWriteTask(task, permissions, userId)
        : false;

    return (
        <TaskDetailModal
            task={task}
            taskBoardColumns={taskBoardColumns}
            onClose={onClose}
            canWrite={canWrite}
            isStatusPending={task ? isPending(task.id) : false}
            onStatusChange={(slug) => {
                if (task) setStatus(task.id, slug);
            }}
            isUpdating={isUpdating}
            errors={errors}
            clearErrors={clearErrors}
            onUpdate={(input, onSuccess) => updateTask(input, onSuccess)}
            onRequestDelete={() => setDeleteOpen(true)}
            deleteSlot={
                task ? (
                    <DeleteTask
                        open={deleteOpen}
                        onClose={() => setDeleteOpen(false)}
                        task={{ id: task.id, heading: task.heading }}
                        skipReload
                        onDeleted={(taskId) => {
                            setDeleteOpen(false);
                            onClose();
                            setTasks((prev) =>
                                prev.filter((item) => item.id !== taskId),
                            );
                        }}
                    />
                ) : null
            }
            labels={{
                viewTitle: t("pages.deals.workspace.tasks.view_title"),
                editTitle: t("pages.deals.workspace.tasks.edit_task"),
                cancel: t("pages.deals.common.cancel"),
                save: t("pages.deals.common.save_changes"),
                delete: t("pages.deals.workspace.tasks.delete_task"),
                edit: t("pages.deals.workspace.tasks.edit_task"),
                titleField: t("pages.deals.workspace.tasks.title_field"),
                description: t("pages.deals.common.description"),
                descriptionPlaceholder: t(
                    "pages.deals.common.optional_details_placeholder",
                ),
                startDate: t("pages.deals.common.start_date"),
                dueDate: t("pages.deals.common.due_date"),
                dueTime: t("pages.deals.common.due_time"),
                priority: t("pages.deals.common.priority"),
                priorityHigh: t("pages.deals.common.priority_high"),
                priorityMedium: t("pages.deals.common.priority_medium"),
                priorityLow: t("pages.deals.common.priority_low"),
                priorityHighest: t("pages.deals.common.priority_highest"),
                priorityUrgent: t("pages.deals.common.priority_urgent"),
                assignees: t("pages.deals.common.assignees"),
                overdue: t("pages.deals.workspace.tasks.overdue"),
                noDescription: t("pages.deals.common.no_description"),
                unassigned: t("pages.deals.common.unassigned"),
                dateRangeError: t(
                    "pages.deals.workspace.tasks.date_range_error",
                ),
            }}
        />
    );
}
