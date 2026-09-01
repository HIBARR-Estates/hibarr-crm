import { useEffect, useState } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
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
import { useLeadWorkspace } from "../../context/LeadWorkspaceContext";
import useLeadTaskStatus from "../../hooks/useLeadTaskStatus";
import useLeadTaskUpdate from "../../hooks/useLeadTaskUpdate";

interface TaskCategoryOption {
    id: number;
    category_name: string;
}

interface EmployeeRecord {
    id: number;
    name: string;
    designation_name?: string;
}

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
    const { lead, setTasks } = useLeadWorkspace();
    const { updateTask, isUpdating, errors, clearErrors } = useLeadTaskUpdate(
        task ?? ({ id: 0 } as Task),
    );

    const canWrite = task ? canWriteTask(task, permissions, userId) : false;

    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const [editing, setEditing] = useState(false);
    const pageProps = props as {
        employees?: EmployeeRecord[];
        taskCategories?: TaskCategoryOption[];
        taskPermissions?: Record<string, string>;
        permissions?: Record<string, string>;
    };
    const employees = pageProps.employees ?? [];
    const permissionSet = (permissions ??
        pageProps.taskPermissions ??
        pageProps.permissions) as TaskPermissionSet | undefined;
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
                    permissions={permissionSet}
                    currentUser={{
                        id: props.auth?.user?.id ?? 0,
                        name: props.auth?.user?.name ?? "",
                        image: props.auth?.user?.image_url,
                    }}
                    people={people}
                    toggling={task ? isPending(task.id) : false}
                    onClose={handleClose}
                    onEdit={() => setEditing(true)}
                    onToggleDone={() => {
                        if (!task) return;
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
                <Deferred data="taskCategories" fallback={null}>
                    <TaskRedesignFormModal
                        open={editing && task !== null}
                        mode="edit"
                        editingTask={task as unknown as RedesignedTask | null}
                        columns={taskBoardColumns}
                        categories={pageProps.taskCategories ?? []}
                        users={people}
                        lockedLinks={[
                            {
                                type: "lead",
                                id: lead.id,
                                name: lead.client_name || "Lead",
                            },
                        ]}
                        saving={isUpdatingRedesignedTask}
                        errors={updateRedesignedTaskErrors}
                        onClose={() => {
                            setEditing(false);
                            clearUpdateRedesignedErrors();
                        }}
                        onSubmit={(values: TaskFormValues) => {
                            if (!task) return;
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
