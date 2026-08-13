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

export interface DashboardTaskUpdateInput {
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

/**
 * Task edits from the dashboard queue.
 *
 * The deal and lead workspaces have the same hook against their own contexts;
 * this one exists because those hooks call useDealWorkspace()/useLeadWorkspace(),
 * which throw outside their providers — and the dashboard has neither.
 *
 * ponytail: a three-way duplication with useDealTaskUpdate / useLeadTaskUpdate.
 * Collapse them the way useTaskStatus was collapsed (a shared hook taking an
 * onUpdated callback) once a third caller needs a fourth behaviour.
 */
export default function useDashboardTaskUpdate(
    task: Task,
    onUpdated: (task: Task) => void,
) {
    const { props } = usePage();
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate, status } = useApiMutate<
        UpdateTaskRequest,
        Task,
        ApiResponse<Task>
    >(route("tasks.update", task.id), "PUT");

    const updateTask = useCallback(
        (input: DashboardTaskUpdateInput, onSuccess?: () => void) => {
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
                // The start date always comes from the form's date-only input,
                // never from task.start_date: that is a full ISO datetime, and
                // appending "THH:mm" to an already-complete "...Z" string yields
                // an unparsable date that dayjs turns into the literal string
                // "Invalid Date", tripping the backend's date_format rule.
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
                        onUpdated(response.data);
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
        [mutate, props.company, onUpdated],
    );

    const clearErrors = useCallback(() => setErrors([]), []);

    return {
        updateTask,
        isUpdating: isLoading({ status }),
        errors,
        clearErrors,
    };
}
