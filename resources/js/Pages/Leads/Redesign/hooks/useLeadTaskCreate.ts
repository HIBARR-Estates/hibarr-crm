import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/api/tasks";

export interface LeadTaskCreateInput {
    title: string;
    dueDate?: string;
    priority: "low" | "medium" | "high";
    description?: string;
}

interface CreateTaskRequest {
    heading: string;
    description?: string;
    due_date?: string;
    without_duedate?: boolean;
    priority: "low" | "medium" | "high";
    taskable_type: "lead";
    taskable_id: number;
    user_id?: number[];
    estimate_hours: number;
    estimate_minutes: number;
}

function mapPhpToDayjsFormat(format: string): string {
    const replacements: Record<string, string> = {
        d: "DD",
        D: "ddd",
        j: "D",
        l: "dddd",
        N: "E",
        S: "Do",
        w: "d",
        z: "DDD",
        W: "W",
        F: "MMMM",
        m: "MM",
        M: "MMM",
        n: "M",
        Y: "YYYY",
        y: "YY",
        a: "a",
        A: "A",
        g: "h",
        G: "H",
        h: "hh",
        H: "HH",
        i: "mm",
        s: "ss",
    };

    return format
        .split("")
        .map((char) => replacements[char] || char)
        .join("");
}

function formatDueDateForApi(isoDate: string, dateFormat: string): string {
    return dayjs(`${isoDate}T12:00:00`).format(mapPhpToDayjsFormat(dateFormat));
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

            if (userId) {
                payload.user_id = [userId];
            }

            if (input.dueDate?.trim()) {
                payload.due_date = formatDueDateForApi(
                    input.dueDate.trim(),
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
