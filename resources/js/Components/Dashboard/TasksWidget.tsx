import React from "react";
import { motion } from "framer-motion";
import { Card, List, Button, Empty, Tag, Avatar, Tooltip } from "antd";
import { Link } from "@inertiajs/react";
import { EyeOutlined, CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { CheckCircle, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import dayjs from "dayjs";

interface Task {
    id: number;
    heading: string;
    due_date: string;
    priority: string;
    status: string;
    project?: {
        project_name: string;
    };
    users: Array<{
        id: number;
        name: string;
        image: string;
    }>;
}

interface TasksWidgetProps {
    tasks: Task[];
}

export default function TasksWidget({ tasks }: TasksWidgetProps) {
    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            high: "red",
            medium: "orange",
            low: "green",
        };
        return colors[priority?.toLowerCase()] || "default";
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case "high":
                return <AlertTriangle size={14} className="text-red-500" />;
            case "medium":
                return <Clock size={14} className="text-orange-500" />;
            case "low":
                return <CheckCircle size={14} className="text-green-500" />;
            default:
                return <CheckCircle size={14} className="text-gray-500" />;
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="h-full"
        >
            <Card
                className="h-full border-0 shadow-sm hover:shadow-lg transition-all duration-300 rounded-2xl"
                bodyStyle={{ padding: 0 }}
                title={
                    <div className="flex justify-between items-center p-6 pb-0">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                Upcoming Tasks
                            </h3>
                            <p className="text-sm text-gray-500">
                                Your priority tasks for today
                            </p>
                        </div>
                        <Link href={route("tasks.index")}>
                            <Button
                                type="text"
                                size="small"
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                                View All
                                <ArrowRight size={14} />
                            </Button>
                        </Link>
                    </div>
                }
            >
                <div className="p-6 pt-4">
                    <List
                        dataSource={tasks}
                        locale={{
                            emptyText: (
                                <Empty
                                    description="No tasks found"
                                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                                    className="py-8"
                                />
                            ),
                        }}
                        split={false}
                        renderItem={(task, index) => (
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.1,
                                }}
                            >
                                <List.Item
                                    className="border-0 border-b border-gray-50 last:border-0 py-4 hover:bg-gray-25 px-2 rounded-lg transition-colors duration-200"
                                    actions={[
                                        <Link
                                            href={route("tasks.show", task.id)}
                                            key="view"
                                        >
                                            <Button
                                                type="text"
                                                size="small"
                                                icon={<EyeOutlined />}
                                                className="text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                            >
                                                View
                                            </Button>
                                        </Link>,
                                    ]}
                                >
                                    <List.Item.Meta
                                        title={
                                            <div className="flex items-center gap-3">
                                                {getPriorityIcon(task.priority)}
                                                <span className="text-sm font-medium text-gray-900">
                                                    {task.heading}
                                                </span>
                                                <Tag
                                                    color={getPriorityColor(
                                                        task.priority
                                                    )}
                                                    className="text-xs"
                                                >
                                                    {task.priority}
                                                </Tag>
                                            </div>
                                        }
                                        description={
                                            <div className="space-y-2 mt-2">
                                                {task.project && (
                                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                                        <div className="w-2 h-2 rounded-full bg-blue-400" />
                                                        Project:{" "}
                                                        {
                                                            task.project
                                                                .project_name
                                                        }
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <CalendarOutlined
                                                        size={12}
                                                    />
                                                    <span>
                                                        Due:{" "}
                                                        {dayjs(
                                                            task.due_date
                                                        ).format("MMM D, YYYY")}
                                                    </span>
                                                    {dayjs(
                                                        task.due_date
                                                    ).isBefore(dayjs()) && (
                                                        <Tag
                                                            color="red"
                                                            className="!m-0 text-xs"
                                                        >
                                                            Overdue
                                                        </Tag>
                                                    )}
                                                </div>
                                                {task.users &&
                                                    task.users.length > 0 && (
                                                        <div className="flex items-center gap-2">
                                                            <Avatar.Group
                                                                maxCount={3}
                                                                size="small"
                                                            >
                                                                {task.users.map(
                                                                    (user) => (
                                                                        <Tooltip
                                                                            key={
                                                                                user.id
                                                                            }
                                                                            title={
                                                                                user.name
                                                                            }
                                                                        >
                                                                            <Avatar
                                                                                src={
                                                                                    user.image
                                                                                }
                                                                                icon={
                                                                                    <UserOutlined />
                                                                                }
                                                                                size="small"
                                                                            />
                                                                        </Tooltip>
                                                                    )
                                                                )}
                                                            </Avatar.Group>
                                                        </div>
                                                    )}
                                            </div>
                                        }
                                    />
                                </List.Item>
                            </motion.div>
                        )}
                    />
                </div>
            </Card>
        </motion.div>
    );
}
