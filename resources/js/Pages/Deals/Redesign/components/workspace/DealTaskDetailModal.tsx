import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import {
    isCompletedColumn,
    type TaskboardColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
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
import {
    afterUpdateTaskFormSubmit,
    patchTaskListExtrasCounts,
} from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import type { TaskPermissionSet } from "@/Pages/Tasks/Redesign/adapters/taskPermissions";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskStatus from "../../hooks/useDealTaskStatus";
import useDealTaskUpdate from "../../hooks/useDealTaskUpdate";

interface TaskCategoryOption {
    id: number;
    category_name: string;
}

interface EmployeeRecord {
    id: number;
    name: string;
    designation_name?: string;
}

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

    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const [editing, setEditing] = useState(false);
    const employees =
        (props as { employees?: EmployeeRecord[] }).employees ?? [];
    const taskCategories =
        (props as { taskCategories?: TaskCategoryOption[] }).taskCategories ??
        [];
    const permissions = props.permissions as TaskPermissionSet | undefined;
    const setRedesignedTasks = (
        updater: (prev: RedesignedTask[]) => RedesignedTask[],
    ) =>
        setTasks(
            (prev) =>
                updater(
                    prev as unknown as RedesignedTask[],
                ) as unknown as typeof prev,
        );
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
        const people = employees.map((employee) => ({
            id: employee.id,
            name: employee.name,
            designation_name: employee.designation_name,
        }));

        return (
            <>
                <TaskRedesignDetailModal
                    task={
                        editing
                            ? null
                            : (task as unknown as RedesignedTask | null)
                    }
                    columns={taskBoardColumns}
                    permissions={permissions}
                    currentUser={{
                        id: props.auth?.user?.id ?? 0,
                        name: props.auth?.user?.name ?? "",
                        image: props.auth?.user?.image_url,
                    }}
                    people={people}
                    toggling={task ? isStatusPending(task.id) : false}
                    canWrite={Boolean(canWriteTask)}
                    onClose={handleClose}
                    onEdit={() => {
                        if (!canWriteTask) return;
                        setEditing(true);
                    }}
                    onToggleDone={() => {
                        if (!canWriteTask || !task) return;
                        const status =
                            task.board_column?.slug || task.status || "to_do";
                        const done =
                            isCompletedColumn(status, taskBoardColumns) ||
                            Boolean(task.completed_on);
                        const target = done
                            ? taskBoardColumns.find(
                                  (column) =>
                                      column.slug === "in_progress" ||
                                      column.slug === "to_do",
                              )
                            : taskBoardColumns.find(
                                  (column) => column.slug === "done",
                              );
                        if (target) setStatus(task.id, target.slug);
                    }}
                />
                <TaskRedesignFormModal
                    open={Boolean(canWriteTask) && editing && task !== null}
                    mode="edit"
                    editingTask={task as unknown as RedesignedTask | null}
                    columns={taskBoardColumns}
                    categories={taskCategories}
                    users={people}
                    saving={isUpdatingRedesignedTask}
                    errors={updateRedesignedTaskErrors}
                    onClose={() => {
                        setEditing(false);
                        clearUpdateRedesignedErrors();
                    }}
                    onSubmit={(values: TaskFormValues) => {
                        if (!canWriteTask || !task) return;
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
                                boardColumnId:
                                    values.boardColumnId ?? undefined,
                                links: formLinksPayload(values),
                            },
                            afterUpdateTaskFormSubmit(
                                task.id,
                                values,
                                persistExtras,
                                () => setEditing(false),
                                (result) => {
                                    setRedesignedTasks((prev) =>
                                        patchTaskListExtrasCounts(
                                            prev,
                                            task.id,
                                            result,
                                        ),
                                    );
                                },
                            ),
                        );
                    }}
                />
            </>
        );
    }

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
