import { Table, Drawer, Empty, Button } from "antd";
import { Task } from "@/Types/api/tasks";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import BulkTaskActionSelector from "@/Features/Tasks/BulkActions/BulkTaskActionSelector";
import { useTasksTableColumns } from "@/Features/Tasks/Columns";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import { PlusOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { isLoading } from "@/lib/utils";
import { useState } from "react";
import { router } from "@inertiajs/react";

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
    permissions = {
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
        handleClose,
        selected: selectedTask,
    } = useGenericEntityAction<Task>();

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Task>();

    // Table columns using the hook
    const columns = useTasksTableColumns({
        columns: taskBoardColumns,
        permissions,
        onEdit: (selectedTask) => handleAction("edit", selectedTask),
        onView: (selectedTask) => handleAction("view", selectedTask),
        onDuplicate: (selectedTask) => handleAction("duplicate", selectedTask),
        onDelete: (selectedTask) => handleAction("delete", selectedTask),
        exclude: ["due_date", "progress", "created_at"],
    });

    const defaultTaskUrl =
        relatedEntity.type === "deal"
            ? `/account/deals/${relatedEntity.id}/tasks/default`
            : "";
    const {
        mutate: createDefaultTask,
        status,
        isError,
    } = useApiMutate(defaultTaskUrl, "POST");

    const isCreatingDefaultTask = isLoading({ status, isError });

    const defaultTasks = [
        { key: "schedule_meeting", label: "Schedule Meeting" },
        { key: "send_property_details", label: "Send Property Details" },
        // { key: "setup_watcher", label: "Set Up Watcher" },
        // { key: "assign_agent", label: "Assign Agent" },
    ];

    return (
        <>
            {tasks.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">No tasks</p>

                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={() => handleAction("add")}
                                >
                                    Add Task
                                </Button>

                                {relatedEntity.type === "deal" && (
                                    <div className="flex gap-2 justify-center mt-4">
                                        {defaultTasks.map((task) => (
                                            <Button
                                                key={task.key}
                                                variant="dashed"
                                                onClick={() => {
                                                    setSelectedTaskType(
                                                        task.key
                                                    );
                                                    return createDefaultTask(
                                                        {
                                                            task_type: task.key,
                                                        },
                                                        {
                                                            onSettled: () => {
                                                                setSelectedTaskType(
                                                                    ""
                                                                );
                                                                router.reload();
                                                            },
                                                        }
                                                    );
                                                }}
                                                loading={
                                                    isCreatingDefaultTask &&
                                                    selectedTaskType ===
                                                        task.key
                                                }
                                                size="small"
                                            >
                                                {task.label}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        }
                    />
                </div>
            )}
            {tasks.length > 0 && (
                <div className="p-6 flex flex-col gap-y-4">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            {relatedEntity.type === "deal" && (
                                <div className="flex gap-2">
                                    {defaultTasks.map((task) => (
                                        <Button
                                            key={task.key}
                                            variant="dashed"
                                            onClick={() => {
                                                setSelectedTaskType(task.key);
                                                return createDefaultTask(
                                                    {
                                                        task_type: task.key,
                                                    },
                                                    {
                                                        onSettled: () => {
                                                            setSelectedTaskType(
                                                                ""
                                                            );
                                                            router.reload();
                                                        },
                                                    }
                                                );
                                            }}
                                            loading={
                                                isCreatingDefaultTask &&
                                                selectedTaskType === task.key
                                            }
                                            size="small"
                                        >
                                            {task.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                        {selectedEntities.length > 0 && (
                            <BulkTaskActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    (e) => e.id
                                )}
                                columns={taskBoardColumns}
                                clearSelected={() => clearSelected()}
                            />
                        )}
                    </div>
                    <Table
                        columns={columns}
                        dataSource={tasks}
                        rowKey="id"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: true,
                            showQuickJumper: true,
                            showTotal: (total) => `Total ${total} tasks`,
                        }}
                        rowSelection={rowSelection}
                    />
                </div>
            )}
            {/* Delete Task Modal */}
            <DeleteTask
                open={action === "delete"}
                task={selectedTask}
                onClose={() => handleClose()}
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
            />

            {/* Task Details Drawer */}
            <Drawer
                title={`Task: ${selectedTask?.heading || ""}`}
                placement="right"
                size="large"
                open={action === "view"}
                onClose={() => handleClose()}
                destroyOnHidden
            >
                <TaskDetailsDrawer task={selectedTask} loading={false} />
            </Drawer>
        </>
    );
}
