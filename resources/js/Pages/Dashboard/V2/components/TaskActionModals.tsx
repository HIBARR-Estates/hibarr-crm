import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import useTaskStatus, { applyTaskStatus } from "@/Hooks/useTaskStatus";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import TaskDetailModal from "@/Components/Redesign/modals/TaskDetailModal";
import useDashboardTaskUpdate from "../hooks/useDashboardTaskUpdate";

interface TaskActionModalsProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
    /** Replaces the open task after an edit or a status change. */
    onPatched: (task: Task) => void;
    /** Re-resolves the deferred queue once the row's data has moved. */
    onChanged: () => void;
}

/**
 * The queue's task modal.
 *
 * No delete control: deleting a record from a dashboard list is a footgun —
 * the row gives no context for what else hangs off it. Deletion stays on the
 * task page, where the task's subtasks, comments and files are visible.
 */
export default function TaskActionModals({
    task,
    taskBoardColumns,
    onClose,
    onPatched,
    onChanged,
}: TaskActionModalsProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;

    const { setStatus, isPending } = useTaskStatus((_taskId, slug) => {
        if (task) onPatched(applyTaskStatus(task, slug));
        onChanged();
    });

    const { updateTask, isUpdating, errors, clearErrors } =
        useDashboardTaskUpdate(task ?? ({ id: 0 } as Task), (updated) => {
            onPatched(updated);
            onChanged();
        });

    // The queue only ever shows tasks this user created or is assigned to
    // (Task::scopeVisibleToUser), so anyone seeing a row may edit it.
    const canWrite = Boolean(
        task &&
            (task.added_by === userId ||
                task.users?.some((user) => user.id === userId)),
    );

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
                assignees: t("pages.deals.common.assignees"),
                overdue: t("pages.deals.workspace.tasks.overdue"),
                noDescription: t("pages.deals.common.no_description"),
                unassigned: t("pages.deals.common.unassigned"),
                dateRangeError: t("pages.deals.workspace.tasks.date_range_error"),
            }}
        />
    );
}
