import React from "react";
import { Card, Dropdown, Button, Typography, Tooltip } from "antd";
import { MoreOutlined, CalendarOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import MultiUserIndicator from "./MultiUserIndicator";

const { Text, Paragraph } = Typography;

export type Priority = "low" | "medium" | "high";

export interface KanbanTaskCardUser {
    id?: string | number;
    name: string;
    image?: string;
    image_url?: string;
}

export interface KanbanTaskCardProps {
    users?: KanbanTaskCardUser[];
    title: string;
    description?: string;
    actions?: MenuProps["items"];
    dueDate?: string | Date | null;
    priority?: Priority;
    isOverdue?: boolean;
    isLoading?: boolean;
    isDragging?: boolean;
    onClick?: () => void;
    className?: string;
}

const priorityConfig: Record<
    Priority,
    { color: string; textColor: string; label: string }
> = {
    low: {
        color: "#52c41a",
        textColor: "text-green-600",
        label: "Low",
    },
    medium: {
        color: "#1890ff",
        textColor: "text-blue-600",
        label: "Medium",
    },
    high: {
        color: "#ff4d4f",
        textColor: "text-red-600",
        label: "High",
    },
};

const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({
    users = [],
    title,
    description,
    actions,
    dueDate,
    priority = "medium",
    isOverdue = false,
    isLoading = false,
    isDragging = false,
    onClick,
    className = "",
}) => {
    const priorityInfo = priorityConfig[priority] || priorityConfig.medium;

    const formattedDueDate = dueDate
        ? dayjs(dueDate).format("MMM D, YYYY")
        : null;

    const fullDueDate = dueDate
        ? dayjs(dueDate).format("MMM D, YYYY h:mm A")
        : null;

    return (
        <Card
            size="small"
            loading={isLoading}
            className={`
                transition-all duration-200 cursor-pointer
                ${isDragging ? "shadow-xl ring-2 ring-blue-400 ring-opacity-50 rotate-1" : "hover:shadow-lg hover:border-gray-300"}
                ${isOverdue ? "border-red-200 bg-gradient-to-br from-red-50 to-white" : "border-gray-200 bg-white"}
                ${className}
            `}
            styles={{
                body: {
                    padding: "14px 16px",
                },
            }}
            variant="outlined"
        >
            {/* Header: Users + Actions */}
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    {users.length > 0 ? (
                        <div className="flex items-center gap-2">
                            <MultiUserIndicator
                                users={users.map((u) => ({
                                    id: u.id,
                                    name: u.name,
                                    image: u.image,
                                    image_url: u.image_url,
                                }))}
                                size="sm"
                                maxCount={3}
                                showNames={false}
                                showTooltip={true}
                            />
                            <div className="flex-1 min-w-0">
                                {users.length === 1 ? (
                                    <Tooltip title={users[0].name}>
                                        <Text
                                            className="text-xs text-gray-600 block truncate max-w-[120px]"
                                            ellipsis
                                        >
                                            {users[0].name}
                                        </Text>
                                    </Tooltip>
                                ) : (
                                    <Tooltip
                                        title={users
                                            .map((u) => u.name)
                                            .join(", ")}
                                    >
                                        <Text
                                            className="text-xs text-gray-600 block truncate max-w-[120px]"
                                            ellipsis
                                        >
                                            {users[0].name}
                                            <span className="text-gray-400 ml-1">
                                                +{users.length - 1}
                                            </span>
                                        </Text>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 h-6">
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-400 text-[10px]">
                                    ?
                                </span>
                            </div>
                            <Text className="text-xs text-gray-400 italic">
                                Unassigned
                            </Text>
                        </div>
                    )}
                </div>

                {actions && actions.length > 0 && (
                    <Dropdown
                        menu={{ items: actions }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 -mr-1 -mt-1 flex-shrink-0"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Dropdown>
                )}
            </div>

            {/* Title */}
            <div className="mb-2" onClick={onClick}>
                <Text
                    strong
                    className="text-sm text-gray-800 leading-snug block hover:text-blue-600 transition-colors"
                    ellipsis={{ tooltip: title }}
                    style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                    }}
                >
                    {title}
                </Text>
            </div>

            {/* Description */}
            {description && (
                <Paragraph
                    className="text-xs text-gray-500 mb-3 leading-relaxed"
                    ellipsis={{
                        rows: 2,
                        tooltip: description,
                    }}
                    style={{ marginBottom: "12px" }}
                >
                    {description}
                </Paragraph>
            )}

            {/* Footer: Due Date + Priority */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                {/* Due Date */}
                <div className="flex items-center gap-1.5">
                    {formattedDueDate ? (
                        <Tooltip title={`Due: ${fullDueDate}`}>
                            <div
                                className={`flex items-center gap-1.5 text-xs ${
                                    isOverdue
                                        ? "text-red-500 font-medium"
                                        : "text-gray-500"
                                }`}
                            >
                                <CalendarOutlined
                                    className={
                                        isOverdue
                                            ? "text-red-500"
                                            : "text-gray-400"
                                    }
                                />
                                <span>{formattedDueDate}</span>
                            </div>
                        </Tooltip>
                    ) : (
                        <span className="text-xs text-gray-400">
                            No due date
                        </span>
                    )}
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1.5">
                    <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: priorityInfo.color }}
                    />
                    <span
                        className={`text-xs font-medium ${priorityInfo.textColor}`}
                    >
                        {priorityInfo.label}
                    </span>
                </div>
            </div>
        </Card>
    );
};

export default KanbanTaskCard;
