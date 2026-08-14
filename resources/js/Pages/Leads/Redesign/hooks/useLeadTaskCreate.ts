import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/api/tasks";
import {
    DEFAULT_START_TIME,
    formatDueDateTimeForApi,
    todayIsoDate,
} from "@/Pages/Deals/Redesign/hooks/taskDateUtils";

export interface LeadTaskCreateInput {
    title: string;
    startDate?: string;
    dueDate?: string;
    dueTime?: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    description?: string;
    assignees?: number[];
}

interface CreateTaskRequest {
    heading: string;
    description?: string;
    start_date?: string;
    due_date?: string;
    without_duedate?: boolean;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    taskable_type: "lead";
    taskable_id: number;
    user_id?: number[];
    estimate_hours: number;
    estimate_minutes: number;
}

export default function useLeadTaskCreate(leadId: number) {
    const { props } = usePage();
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate, status } = useApiMutate<
        CreateTaskRequest,
        Task,
        ApiResponse<Task>
    >(route("tasks.store"), "POST");

    const createTask = useCallback(
        (input: LeadTaskCreateInput, onSuccess?: (task?: Task) => void) => {
            const title = input.title.trim();
            if (!title) {
                setErrors(["Task title is required"]);
                return;
            }

            const company = props.company;
            const dateFormat = `${company?.date_format || "d-m-Y"} ${company?.time_format || "H:i"}`;
            const userId = props.auth?.user?.id;

            const payload: CreateTaskRequest = {
                heading: title,
                description: input.description?.trim() || "",
                priority: input.priority,
                taskable_type: "lead",
                taskable_id: leadId,
                estimate_hours: 0,
                estimate_minutes: 0,
            };

            const assignees = input.assignees?.length
                ? input.assignees
                : userId
                  ? [userId]
                  : undefined;
            if (!assignees?.length) {
                setErrors(["At least one assignee is required"]);
                return;
            }
            payload.user_id = assignees;

            payload.start_date = formatDueDateTimeForApi(
                input.startDate?.trim() || todayIsoDate(),
                DEFAULT_START_TIME,
                dateFormat,
            );

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
                    if (!isSuccessResponse(response)) return;
                    setErrors([]);
                    onSuccess?.(response.data as Task | undefined);
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to create task"],
                    );
                },
            });
        },
        [leadId, mutate, props.auth?.user?.id, props.company],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        createTask,
        isCreating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
