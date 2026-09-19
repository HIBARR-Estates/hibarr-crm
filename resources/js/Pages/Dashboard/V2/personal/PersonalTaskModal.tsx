import { useEffect, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
import type { Task as RedesignedTask } from "@/Types/Task";
import TaskDetailModal from "@/Components/Redesign/modals/TaskDetailModal";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import TaskRedesignDetailModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignDetailModal";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import {
    formLinksPayload,
    type TaskFormValues,
} from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterUpdateTaskFormSubmit } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import useDashboardTaskUpdate from "../hooks/useDashboardTaskUpdate";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface PersonalTaskModalProps {
    task: Task | null;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
    /** Replaces the open task after an edit — the row and the modal share it. */
    onPatched: (task: Task) => void;
    /** Non-"done" status changes — general dropdown moves in the old modal. */
    setStatus: (taskId: number, slug: string) => void;
    isStatusPending: (taskId: number) => boolean;
    /** The row's own optimistic Complete path — see PersonalDashboard. */
    onComplete: (task: Task) => void;
    /** Re-resolves the deferred queue after an edit changes what's on screen. */
    onChanged: () => void;
}

/**
 * The queue's task modal.
 *
 * Behind crm.tasks-workspace-redesign, this is the same TaskDetailModal the
 * Tasks page itself uses (comments, activity log, checklist, attachments) —
 * TaskRedesignDetailModal/TaskRedesignFormModal are the drop-in pair built
 * for exactly this: reusing one modal everywhere a task opens, rather than
 * this page carrying its own permanently-behind copy. Off, it falls back to
 * the older single-modal TaskDetailModal, same as before.
 *
 * `people` ships empty: comment @mentions and reassignment to someone else
 * both need a company-wide user list this page doesn't fetch. Everything
 * else — view, edit, checklist, attachments, complete — works without one.
 */
export default function PersonalTaskModal({
    task,
    taskBoardColumns,
    onClose,
    onPatched,
    setStatus,
    isStatusPending,
    onComplete,
    onChanged,
}: PersonalTaskModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const [editing, setEditing] = useState(false);

    const { updateTask, isUpdating, errors, clearErrors } = useDashboardTaskUpdate(
        task ?? ({ id: 0 } as Task),
        (updated) => {
            onPatched(updated);
            onChanged();
        },
    );

    // The queue only ever shows tasks this user created or is assigned to
    // (Task::scopeVisibleToUser), so anyone seeing a row may edit it.
    const canWrite = Boolean(
        task &&
            (task.added_by === userId ||
                task.users?.some((user) => user.id === userId)),
    );

    const setRedesignedTasks = (
        updater: (prev: RedesignedTask[]) => RedesignedTask[],
    ) => {
        if (!task) return;
        const [patched] = updater([task as unknown as RedesignedTask]);
        if (patched) onPatched(patched as unknown as Task);
    };

    const {
        updateTask: updateRedesignedTask,
        isUpdating: isUpdatingRedesignedTask,
        updateErrors: updateRedesignedTaskErrors,
        clearUpdateErrors: clearUpdateRedesignedErrors,
    } = useTasksWorkspaceMutations(setRedesignedTasks, task?.id ?? null);
    const { persistExtras } = useTaskExtras();

    useEffect(() => {
        setEditing(false);
    }, [task?.id]);

    const handleClose = () => {
        setEditing(false);
        clearUpdateRedesignedErrors();
        onClose();
    };

    if (useRedesignedTasks) {
        return (
            <>
                <TaskRedesignDetailModal
                    task={editing ? null : (task as unknown as RedesignedTask | null)}
                    columns={taskBoardColumns}
                    permissions={undefined}
                    currentUser={{
                        id: props.auth?.user?.id ?? 0,
                        name: props.auth?.user?.name ?? "",
                        image: props.auth?.user?.image_url,
                    }}
                    people={[]}
                    toggling={task ? isStatusPending(task.id) : false}
                    canWrite={canWrite}
                    onClose={handleClose}
                    onEdit={() => {
                        if (!canWrite) return;
                        setEditing(true);
                    }}
                    onToggleDone={() => {
                        // The queue only ever holds pending tasks, so opening
                        // it from here is always a completion, never a reopen.
                        if (!canWrite || !task) return;
                        onComplete(task);
                    }}
                />
                <Deferred data="taskCategories" fallback={null}>
                    <TaskRedesignFormModal
                        open={canWrite && editing && task !== null}
                        mode="edit"
                        editingTask={task as unknown as RedesignedTask | null}
                        columns={taskBoardColumns}
                        categories={
                            (props.taskCategories as unknown as
                                | CategoryOption[]
                                | undefined) ?? []
                        }
                        saving={isUpdatingRedesignedTask}
                        errors={updateRedesignedTaskErrors}
                        onClose={() => {
                            setEditing(false);
                            clearUpdateRedesignedErrors();
                        }}
                        onSubmit={(values: TaskFormValues) => {
                            if (!canWrite || !task) return;
                            updateRedesignedTask(
                                task.id,
                                {
                                    title: values.title,
                                    startDate: values.startDate,
                                    dueDate: values.dueDate,
                                    dueTime: values.dueTime,
                                    priority: values.priority,
                                    description: values.description,
                                    assignees: values.assignees,
                                    categoryId: values.categoryId,
                                    boardColumnId: values.boardColumnId ?? undefined,
                                    links: formLinksPayload(values),
                                },
                                afterUpdateTaskFormSubmit(
                                    task.id,
                                    values,
                                    persistExtras,
                                    () => setEditing(false),
                                    () => onChanged(),
                                ),
                            );
                        }}
                    />
                </Deferred>
            </>
        );
    }

    return (
        <TaskDetailModal
            task={task}
            taskBoardColumns={taskBoardColumns}
            onClose={onClose}
            canWrite={canWrite}
            isStatusPending={task ? isStatusPending(task.id) : false}
            onStatusChange={(slug) => {
                if (!task) return;
                if (slug === "done") {
                    onComplete(task);
                } else {
                    setStatus(task.id, slug);
                }
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
                priorityHighest: t("pages.deals.common.priority_highest"),
                priorityUrgent: t("pages.deals.common.priority_urgent"),
                assignees: t("pages.deals.common.assignees"),
                overdue: t("pages.deals.workspace.tasks.overdue"),
                noDescription: t("pages.deals.common.no_description"),
                unassigned: t("pages.deals.common.unassigned"),
                dateRangeError: t("pages.deals.workspace.tasks.date_range_error"),
            }}
        />
    );
}
