import { Empty, Button } from "antd";
import { useMemo } from "react";
import { Task } from "@/Types/api/tasks";
import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { SaveTaskModal, TaskDetailsModal } from "@/Features/Tasks/SaveTask";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import BulkTaskActionSelector from "@/Features/Tasks/BulkActions/BulkTaskActionSelector";
import TaskRowList from "@/Features/Tasks/Components/TaskRowList";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { PlusOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { isLoading } from "@/lib/utils";
import { useState } from "react";
import { router } from "@inertiajs/react";
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
        view_tasks: string; // 'all' | 'added' | 'owned' | 'both'
        [key: string]: string;
    };
}

export default function TasksTab({
    tasks,
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
    const [selectedTaskType, setSelectedTaskType] = useState<string>("");
    const {
        action,
        handleAction,
        handleClose: closeAction,
        selected: selectedTask,
    } = useGenericEntityAction<Task>();
    const { td } = useTd();
    const { user, permissions } = usePermission();

    const handleClose = () => {
        router.reload({ only: ["tasks"] });
        closeAction();
    };

    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);

    const handleSelectionChange = (ids: number[], tasks: Task[]) => {
        setSelectedIds(ids);
        setSelectedTasks(tasks);
    };

    const clearSelected = () => {
        setSelectedIds([]);
        setSelectedTasks([]);
    };

    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const handleStatusChange = (task: Task, newStatus: string, _columnId: number) => {
        updateTaskStatus(
            { taskId: task.id, status: newStatus },
            { onSuccess: () => router.reload({ only: ["tasks"] }) },
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
    const { mutate: createDefaultTask, status, isError } = useApiMutate(defaultTaskUrl, "POST");
    const isCreatingDefaultTask = isLoading({ status, isError });

    const defaultTasks = [
        { key: "schedule_meeting", label: "Schedule Meeting" },
        { key: "send_property_details", label: "Send Property Details" },
    ];

    const completionRate = useMemo(() => {
        if (tasks.length === 0) return 0;
        const done = tasks.filter((t) =>
            isCompletedColumn((t as any).board_column?.slug || (t as any).status, taskBoardColumns),
        ).length;
        return Math.round((done / tasks.length) * 100);
    }, [tasks, taskBoardColumns]);

    return (
        <>
            {/* Header — matches dashboard card title style */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">{td("Tasks")}</span>
                <div className="flex items-center gap-3">
                    {/* Completion progress */}
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                        <span className="whitespace-nowrap text-[11px] tabular-nums text-slate-500">
                            {completionRate}% done
                        </span>
                    </div>
                    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {tasks.length} tasks
                    </span>
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
                                loading={isCreatingDefaultTask && selectedTaskType === task.key}
                                onClick={() => {
                                    setSelectedTaskType(task.key);
                                    createDefaultTask(
                                        { task_type: task.key },
                                        {
                                            onSettled: () => {
                                                setSelectedTaskType("");
                                                router.reload({ only: ["tasks"] });
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
                            {td("Add Task")}
                        </Button>
                    )}
                </div>
            </div>

            {tasks.length === 0 ? (
                <div className="p-8">
                    <Empty description={td("No tasks yet")} />
                </div>
            ) : (
                <TaskRowList
                    tasks={tasks as any}
                    columns={taskBoardColumns}
                    selectedIds={selectedIds}
                    onSelectionChange={handleSelectionChange}
                    onEdit={(task) => handleAction("edit", task as any)}
                    onView={(task) => handleAction("view", task as any)}
                    onDelete={(task) => handleAction("delete", task as any)}
                    onDuplicate={(task) => handleAction("duplicate", task as any)}
                    onStatusChange={handleStatusChange as any}
                    canEdit={(task) => hasTaskPermission(task as any, "edit_tasks")}
                    canDelete={(task) => hasTaskPermission(task as any, "delete_tasks")}
                    canChangeStatus={(task) => hasTaskPermission(task as any, "change_status")}
                    suppressEntityType={relatedEntity.type === "lead" ? "lead" : undefined}
                    td={td}
                />
            )}
            {/* Delete Task Modal */}
            <DeleteTask
                open={action === "delete"}
                task={selectedTask}
                onClose={() => handleClose()}
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
            />

            <TaskDetailsModal
                task={selectedTask}
                open={action === "view"}
                onClose={() => handleClose()}
                columns={taskBoardColumns}
                td={td}
            />
        </>
    );
}
