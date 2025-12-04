import React, { useState } from "react";
import { Button, Card, List, Tag, Avatar, Tooltip, Empty } from "antd";
import {
    PlusOutlined,
    CalendarOutlined,
    UserOutlined,
} from "@ant-design/icons";
import { Task } from "@/Types/api/tasks";
import SaveTaskModal from "@/Features/Tasks/SaveTask/SaveTaskModal";

interface Props {
    tasks: Task[];
    relatedEntity: {
        type: "deal" | "lead" | "property";
        id: number;
    };
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

export default function TasksTab({
    tasks,
    relatedEntity,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | undefined>(
        undefined
    );

    const handleCreate = () => {
        setSelectedTask(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Tasks</h3>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleCreate}
                >
                    Add Task
                </Button>
            </div>

            {tasks.length === 0 ? (
                <Empty description="No tasks found" />
            ) : (
                <List
                    grid={{ gutter: 16, column: 1 }}
                    dataSource={tasks}
                    renderItem={(task) => (
                        <List.Item>
                            <Card
                                size="small"
                                className="cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => handleEdit(task)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-base">
                                                {task.heading}
                                            </span>
                                            <Tag
                                                color={
                                                    task.boardColumn
                                                        ?.label_color
                                                }
                                            >
                                                {task.boardColumn?.column_name}
                                            </Tag>
                                            <Tag
                                                color={
                                                    task.priority === "high"
                                                        ? "red"
                                                        : task.priority ===
                                                          "medium"
                                                        ? "orange"
                                                        : "green"
                                                }
                                            >
                                                {task.priority}
                                            </Tag>
                                        </div>
                                        <div
                                            className="text-gray-500 text-sm mb-2 line-clamp-2"
                                            dangerouslySetInnerHTML={{
                                                __html: task.description || "",
                                            }}
                                        />

                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            {task.due_date && (
                                                <span className="flex items-center gap-1">
                                                    <CalendarOutlined />
                                                    Due: {task.due_date}
                                                </span>
                                            )}
                                            {task.users &&
                                                task.users.length > 0 && (
                                                    <div className="flex -space-x-2">
                                                        {task.users.map(
                                                            (user) => (
                                                                <Tooltip
                                                                    title={
                                                                        user.name
                                                                    }
                                                                    key={
                                                                        user.id
                                                                    }
                                                                >
                                                                    <Avatar
                                                                        src={
                                                                            user.image
                                                                        }
                                                                        size="small"
                                                                        icon={
                                                                            <UserOutlined />
                                                                        }
                                                                    />
                                                                </Tooltip>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </List.Item>
                    )}
                />
            )}

            <SaveTaskModal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                task={selectedTask}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={relatedEntity}
            />
        </div>
    );
}
