import React from "react";
import { Card, Dropdown, Button, Typography, Tooltip } from "antd";
import { MoreOutlined, CalendarOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs from "dayjs";
import MultiUserIndicator from "./MultiUserIndicator";
import { getPriorityConfig } from "@/lib/priority";

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
    const priorityInfo = getPriorityConfig(priority);

    const formattedDueDate = dueDate
        ? dayjs(dueDate).format("MMM D, YYYY h:mm A")
        : null;

    const fullDueDate = formattedDueDate;

    return (
        <Card
            size="small"
            loading={isLoading}
            className={`
                transition-all duration-150 cursor-pointer rounded-lg
                ${isDragging ? "ring-1 ring-blue-400 rotate-1 opacity-60" : "hover:border-gray-300"}
                ${isOverdue ? "border-red-200" : "border border-gray-200"}
                ${className}
            `}
            styles={{
                body: {
                    padding: "10px 12px",
                    backgroundColor: "#f3f4f545",
                },
            }}
            style={{
                backgroundColor: "#f3f4f545",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#e5e7eb";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#f3f4f545";
            }}
            variant="outlined"
        >
            {/* Header: Users + Actions */}
            <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                    {users.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <MultiUserIndicator
                                users={users.map((u) => ({
                                    id: u.id,
                                    name: u.name,
                                    image: u.image,
                                    image_url: u.image_url,
                                }))}
                                size="xs"
                                maxCount={3}
                                showNames={false}
                                showTooltip={true}
                            />
                            <div className="flex-1 min-w-0">
                                {users.length === 1 ? (
                                    <Tooltip title={users[0].name}>
                                        <Text
                                            className="text-[13px] text-gray-600 block truncate max-w-[100px]"
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
                                            className="text-[13px] text-gray-600 block truncate max-w-[100px]"
                                            ellipsis
                                        >
                                            {users[0].name}
                                            <span className="text-gray-400 ml-0.5">
                                                +{users.length - 1}
                                            </span>
                                        </Text>
                                    </Tooltip>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                                <span className="text-gray-400 text-[10px]">
                                    ?
                                </span>
                            </div>
                            <Text className="text-[13px] text-gray-400 italic">
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
                            icon={<MoreOutlined className="text-[14px]" />}
                            size="small"
                            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 -mr-1 flex-shrink-0 w-6 h-6 min-w-0 p-0"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Dropdown>
                )}
            </div>

            {/* Title */}
            <div className="mb-1.5" onClick={onClick}>
                <Text
                    strong
                    className="text-[15px] text-gray-800 leading-tight block hover:text-blue-600 transition-colors font-medium"
                >
                    {title}
                </Text>
            </div>

            {/* Description */}
            {description && (
                <Paragraph
                    className="text-[13px] text-gray-500 mb-2 leading-snug"
                    ellipsis={{
                        rows: 2,
                        tooltip: description,
                    }}
                    style={{ marginBottom: "8px" }}
                >
                    {description}
                </Paragraph>
            )}

            {/* Footer: Due Date + Priority */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                {/* Due Date */}
                <div className="flex items-center">
                    {formattedDueDate ? (
                        <Tooltip title={`Due: ${fullDueDate}`}>
                            <div
                                className={`flex items-center gap-1 text-[12px] ${
                                    isOverdue
                                        ? "text-red-500 font-medium"
                                        : "text-gray-400"
                                }`}
                            >
                                <CalendarOutlined className="text-[12px]" />
                                <span>{formattedDueDate}</span>
                            </div>
                        </Tooltip>
                    ) : (
                        <span className="text-[12px] text-gray-300">
                            No due date
                        </span>
                    )}
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1">
                    <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: priorityInfo.color }}
                    />
                    <span
                        className={`text-[12px] font-medium ${priorityInfo.textColor}`}
                    >
                        {priorityInfo.label}
                    </span>
                </div>
            </div>
        </Card>
    );
};

export default KanbanTaskCard;
