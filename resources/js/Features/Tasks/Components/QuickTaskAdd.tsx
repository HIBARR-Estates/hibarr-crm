import React, { useState } from "react";
import { Input, Button, message } from "antd";
import { PlusOutlined, LoadingOutlined } from "@ant-design/icons";
import { taskApi } from "@/lib/api/tasks";
import { isLoading as loading } from "@/lib/utils";

interface QuickTaskAddProps {
    boardColumnId?: number;
    projectId?: number;
    onSuccess?: () => void;
    placeholder?: string;
}

const QuickTaskAdd: React.FC<QuickTaskAddProps> = ({
    boardColumnId,
    projectId,
    onSuccess,
    placeholder = "Create new task...",
}) => {
    const [isActive, setIsActive] = useState(false);
    const [heading, setHeading] = useState("");

    const { mutate: createTask, status } = taskApi.useCreateTask();

    const isLoading = loading({ status });

    const handleSubmit = () => {
        if (!heading.trim()) {
            setIsActive(false);
            return;
        }

        createTask(
            {
                heading,
                board_column_id: boardColumnId,
                project_id: projectId,
                priority: "medium", // Default
            },
            {
                onSuccess: () => {
                    message.success("Task created");
                    setHeading("");
                    if (onSuccess) onSuccess();
                    // Keep active for rapid entry? Or close?
                    // Jira keeps it open.
                },
                onError: () => {
                    // Error handled by global handler or add local feedback
                },
            }
        );
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSubmit();
        } else if (e.key === "Escape") {
            setIsActive(false);
            setHeading("");
        }
    };

    if (!isActive) {
        return (
            <div
                className="p-2 cursor-pointer text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded transition-colors flex items-center gap-2"
                onClick={() => setIsActive(true)}
            >
                <PlusOutlined />
                <span>Create Task</span>
            </div>
        );
    }

    return (
        <div className="p-2 bg-white border border-blue-500 rounded shadow-sm animate-fade-in">
            <Input
                autoFocus
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                disabled={isLoading}
                suffix={isLoading ? <LoadingOutlined /> : null}
                onBlur={() => {
                    if (!heading.trim()) setIsActive(false);
                }}
            />
            <div className="text-xs text-gray-400 mt-1 flex justify-between">
                <span>Press Enter to save, Esc to cancel</span>
            </div>
        </div>
    );
};

export default QuickTaskAdd;
