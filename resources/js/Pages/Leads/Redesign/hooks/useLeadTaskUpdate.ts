import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/api/tasks";
import {
    DEFAULT_START_TIME,
    formatDueDateTimeForApi,
    todayIsoDate,
} from "@/Pages/Deals/Redesign/hooks/taskDateUtils";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

export interface LeadTaskUpdateInput {
    title: string;
    startDate?: string;
    dueDate?: string;
    dueTime?: string;
    priority: "low" | "medium" | "high";
    description?: string;
    assignees: number[];
}

interface UpdateTaskRequest {
    heading: string;
    description?: string;
    due_date?: string;
    without_duedate?: boolean;
    start_date: string;
    priority: "low" | "medium" | "high";
    user_id: number[];
}

export default function useLeadTaskUpdate(task: Task) {
    const { props } = usePage();
    const [errors, setErrors] = useState<string[]>([]);
    const { setTasks } = useLeadWorkspace();

    const { mutate, status } = useApiMutate<
        UpdateTaskRequest,
        Task,
        ApiResponse<Task>
    >(route("tasks.update", task.id), "PUT");

    const updateTask = useCallback(
        (input: LeadTaskUpdateInput, onSuccess?: () => void) => {
            const title = input.title.trim();
            if (!title) {
                setErrors(["Task title is required"]);
                return;
            }

            const company = props.company;
            const dateFormat = `${company?.date_format || "d-m-Y"} ${company?.time_format || "H:i"}`;

            const payload: UpdateTaskRequest = {
                heading: title,
                description: input.description?.trim() || "",
                priority: input.priority,
                start_date: formatDueDateTimeForApi(
                    input.startDate?.trim() || todayIsoDate(),
                    DEFAULT_START_TIME,
                    dateFormat,
                ),
                user_id: input.assignees,
            };

            if (input.dueDate?.trim()) {
                payload.due_date = formatDueDateTimeForApi(
                    input.dueDate.trim(),
                    input.dueTime,
                    dateFormat,
                );
            } else {
                payload.without_duedate = true;
            }

            setErrors([]);
            mutate(payload, {
                onSuccess: (response) => {
                    setErrors([]);
                    if (response?.data) {
                        const updated = response.data;
                        setTasks((prev) =>
                            prev.map((item) =>
                                item.id === updated.id ? updated : item,
                            ),
                        );
                    }
                    onSuccess?.();
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to update task"],
                    );
                },
            });
        },
        [mutate, props.company, setTasks],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateTask,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
