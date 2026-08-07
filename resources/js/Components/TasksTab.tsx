import { Empty, Button, Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { Task } from "@/Types/api/tasks";
import {
    isCompletedColumn,
    type TaskboardColumn as StatusColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { SaveTaskModal, TaskDetailsModal } from "@/Features/Tasks/SaveTask";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import BulkTaskActionSelector from "@/Features/Tasks/BulkActions/BulkTaskActionSelector";
import TaskRowList from "@/Features/Tasks/Components/TaskRowList";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { PlusOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { isLoading } from "@/lib/utils";
import { taskApi } from "@/lib/api/tasks";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { usePermission } from "@/lib/permissionUtils";
import { PermissionKey } from "@/Types/permission";

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface Props {
    tasks: Task[];
    /** When true, chrome (header/add/count) stays visible; only the list shows a loader. */
    isLoading?: boolean;
    relatedEntity: {
        type: "deal" | "lead" | "property";
        id: number;
    };
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: TaskboardColumn[];
    employees: any[];
    projects: any[];
    permissions?: {
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string;
        [key: string]: string;
    };
}

function applyLocalStatus(
    task: Task,
    statusSlug: string,
    columns: TaskboardColumn[],
): Task {
    const column = columns.find((c) => c.slug === statusSlug);
    const done = isCompletedColumn(statusSlug, columns as StatusColumn[]);
    return {
        ...task,
        status: statusSlug,
        board_column_id: column?.id ?? task.board_column_id,
        completed_on: done ? new Date().toISOString() : undefined,
        ...(column
            ? {
                  board_column: {
                      id: column.id,
                      column_name: column.column_name,
                      slug: column.slug,
                      label_color: column.label_color,
                  },
              }
            : {}),
    } as Task;
}

export default function TasksTab({
    tasks: tasksProp,
    isLoading: tasksLoading = false,
    relatedEntity,
    taskCategories,
    taskLabels,
    taskBoardColumns = [],
    employees,
    projects,
    permissions: permissionsProp = {
        add_tasks: "all",
        edit_tasks: "all",
        delete_tasks: "all",
        view_tasks: "all",
    },
}: Props) {
    const [localTasks, setLocalTasks] = useState<Task[]>(tasksProp);
    const [selectedTaskType, setSelectedTaskType] = useState<string>("");
    const {
        action,
        handleAction,
        handleClose: closeAction,
        selected: selectedTask,
    } = useGenericEntityAction<Task>();
    const { td } = useTd();
    const { user, permissions } = usePermission();

    useEffect(() => {
        setLocalTasks(tasksProp);
    }, [tasksProp]);

    const handleClose = () => {
        closeAction();
    };

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);

    const handleSelectionChange = (ids: number[], nextTasks: Task[]) => {
        setSelectedIds(ids);
        setSelectedTasks(nextTasks);
    };

    const clearSelected = () => {
        setSelectedIds([]);
        setSelectedTasks([]);
    };

    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const handleStatusChange = (
        task: Task,
        newStatus: string,
        _columnId: number,
    ) => {
        setLocalTasks((prev) =>
            prev.map((t) =>
                t.id === task.id
                    ? applyLocalStatus(t, newStatus, taskBoardColumns)
                    : t,
            ),
        );
        updateTaskStatus(
            { taskId: task.id, status: newStatus },
            {
                onError: () => {
                    const serverTask =
                        tasksProp.find((t) => t.id === task.id) ?? task;
                    setLocalTasks((prev) =>
                        prev.map((t) => (t.id === task.id ? serverTask : t)),
                    );
                },
            },
        );
    };

    const hasTaskPermission = (task: Task, permissionName: PermissionKey) => {
        const perm = permissions?.[permissionName];
        if (perm === "all") return true;
        if (!perm || perm === "none") return false;
        const isAdded = task.added_by === user?.id;
        const isOwned = (task as any).users?.some((u: any) => u.id === user?.id);
        if (perm === "added" && isAdded) return true;
        if (perm === "owned" && isOwned) return true;
        if (perm === "both" && (isAdded || isOwned)) return true;
        return false;
    };

    const defaultTaskUrl =
        relatedEntity.type === "deal"
            ? `/account/deals/${relatedEntity.id}/tasks/default`
            : "";
    const { mutate: createDefaultTask, status, isError } = useApiMutate(
        defaultTaskUrl,
        "POST",
    );
    const isCreatingDefaultTask = isLoading({ status, isError });

    const defaultTasks = [
        { key: "schedule_meeting", label: "Schedule Meeting" },
        { key: "send_property_details", label: "Send Property Details" },
    ];

    const completionRate = useMemo(() => {
        if (localTasks.length === 0) return 0;
        const done = localTasks.filter((t) =>
            isCompletedColumn(
                (t as any).board_column?.slug || (t as any).status,
                taskBoardColumns as StatusColumn[],
            ),
        ).length;
        return Math.round((done / localTasks.length) * 100);
    }, [localTasks, taskBoardColumns]);

    const mergeSavedTask = (saved?: Task) => {
        if (!saved?.id) return;
        setLocalTasks((prev) => {
            const exists = prev.some((t) => t.id === saved.id);
            if (exists) {
                return prev.map((t) => (t.id === saved.id ? { ...t, ...saved } : t));
            }
            return [saved, ...prev];
        });
    };

    return (
        <>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">{td("Tasks", { source: "en" })}</span>
                <div className="flex items-center gap-3">
                    {!tasksLoading && (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                        style={{
                                            width: `${completionRate}%`,
                                        }}
                                    />
                                </div>
                                <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500">
                                    {`${completionRate}% done`}
                                </span>
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                {`${localTasks.length} tasks`}
                            </span>
                        </>
                    )}
                    {selectedTasks.length > 0 && (
                        <BulkTaskActionSelector
                            selectedEntityIds={selectedIds}
                            columns={taskBoardColumns}
                            clearSelected={clearSelected}
                            td={td}
                        />
                    )}
                    {relatedEntity.type === "deal" &&
                        defaultTasks.map((task) => (
                            <Button
                                key={task.key}
                                variant="dashed"
                                size="small"
                                loading={
                                    isCreatingDefaultTask &&
                                    selectedTaskType === task.key
                                }
                                onClick={() => {
                                    setSelectedTaskType(task.key);
                                    createDefaultTask(
                                        { task_type: task.key },
                                        {
                                            onSettled: () => {
                                                setSelectedTaskType("");
                                            },
                                            onSuccess: (response: any) => {
                                                if (response?.data) {
                                                    mergeSavedTask(response.data);
                                                }
                                            },
                                        },
                                    );
                                }}
                            >
                                {task.label}
                            </Button>
                        ))}
                    {relatedEntity.type !== "deal" && (
                        <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => handleAction("add")}
                        >
                            {td("Add Task", { source: "en" })}
                        </Button>
                    )}
                </div>
            </div>

            {tasksLoading ? (
                <div className="flex justify-center py-16">
                    <Spin />
                </div>
            ) : localTasks.length === 0 ? (
                <div className="p-8">
                    <Empty description={td("No tasks yet", { source: "en" })} />
                </div>
            ) : (
                <TaskRowList
                    tasks={localTasks as any}
                    columns={taskBoardColumns}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onEdit={(task) => handleAction("edit", task as any)}
                    onView={(task) => handleAction("view", task as any)}
                    onDelete={(task) => handleAction("delete", task as any)}
                    onDuplicate={(task) => handleAction("duplicate", task as any)}
                    onStatusChange={handleStatusChange as any}
                    canEdit={(task) => hasTaskPermission(task as any, "edit_tasks")}
                    canDelete={(task) =>
                        hasTaskPermission(task as any, "delete_tasks")
                    }
                    canChangeStatus={(task) =>
                        hasTaskPermission(task as any, "change_status")
                    }
                    suppressEntityType={
                        relatedEntity.type === "lead" ? "lead" : undefined
                    }
                    td={td}
                />
            )}

            <DeleteTask
                open={action === "delete"}
                task={selectedTask}
                onClose={() => handleClose()}
                onDeleted={(taskId) => {
                    setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
                    clearSelected();
                }}
                skipReload
                td={td}
            />
            <SaveTaskModal
                open={["add", "edit", "duplicate"].includes(action || "")}
                onClose={() => handleClose()}
                isDuplicate={action === "duplicate"}
                task={selectedTask}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={relatedEntity}
                td={td}
                reloadKeys={false}
                onSuccess={(saved) => mergeSavedTask(saved as Task | undefined)}
            />

            <TaskDetailsModal
                task={selectedTask as any}
                open={action === "view"}
                onClose={() => handleClose()}
                columns={taskBoardColumns}
                td={td}
                skipReload
                canChangeStatus={
                    selectedTask
                        ? hasTaskPermission(selectedTask, "change_status")
                        : false
                }
                onStatusChange={(taskId, statusSlug) => {
                    setLocalTasks((prev) =>
                        prev.map((t) =>
                            t.id === taskId
                                ? applyLocalStatus(t, statusSlug, taskBoardColumns)
                                : t,
                        ),
                    );
                }}
            />
        </>
    );
}
