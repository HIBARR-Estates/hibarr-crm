import { useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import type { Task } from "@/Types/api/tasks";
import TaskDetailModal from "@/Components/Redesign/modals/TaskDetailModal";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import useDealTaskUpdate from "../../hooks/useDealTaskUpdate";

interface DealTaskDetailModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
}

export default function DealTaskDetailModal({
    task,
    taskBoardColumns,
    onClose,
}: DealTaskDetailModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const [deleteOpen, setDeleteOpen] = useState(false);
    const { setStatus, isPending: isStatusPending } = useDealTaskStatus();
    const { deal, setTasks } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const { updateTask, isUpdating, errors, clearErrors } = useDealTaskUpdate(
        task ?? ({ id: 0 } as Task),
    );

    const canWriteTask = !isWatcherOnly || task?.added_by === userId;

    return (
        <TaskDetailModal
            task={task}
            taskBoardColumns={taskBoardColumns}
            onClose={onClose}
            canWrite={Boolean(canWriteTask)}
            isStatusPending={task ? isStatusPending(task.id) : false}
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
