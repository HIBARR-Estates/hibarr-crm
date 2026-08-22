import { useCallback, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/Task";
import {
    DEFAULT_START_TIME,
    formatDueDateTimeForApi,
    todayIsoDate,
} from "@/Pages/Deals/Redesign/hooks/taskDateUtils";

interface TaskFormInput {
    title: string;
    startDate?: string;
    dueDate?: string;
    dueTime?: string;
    priority: string;
    description?: string;
    assignees: number[];
    categoryId?: number | null;
    boardColumnId?: number | null;
    links?: Array<{ type: string; id: number }>;
}

interface TaskRequestPayload {
    heading: string;
    description?: string;
    start_date: string;
    due_date?: string;
    without_duedate?: boolean;
    priority: string;
    user_id: number[];
    category_id?: number | null;
    board_column_id?: number;
    links?: Array<{ type: string; id: number }>;
}

/** Same request shape/date formatting as the Deal/Lead workspace task hooks, applied at the Tasks workspace level. */
function buildPayload(
    input: TaskFormInput,
    dateFormat: string,
): TaskRequestPayload {
    const payload: TaskRequestPayload = {
        heading: input.title.trim(),
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

    payload.category_id = input.categoryId ?? null;
    if (input.boardColumnId) {
        payload.board_column_id = input.boardColumnId;
    }
    // Only send `links` when the caller manages them, so other callers can't
    // accidentally clear a task's existing relations (see syncTaskLinks).
    if (input.links) {
        payload.links = input.links;
    }

    return payload;
}

/**
 * Create/update mutations for the redesigned Tasks workspace. Patches the
 * caller-supplied local task list instead of reloading, per the
 * mutation-patches-local-state rule this redesign follows.
 */
export default function useTasksWorkspaceMutations(
    setTasks: (updater: (prev: Task[]) => Task[]) => void,
    editingTaskId: number | null,
) {
    const { props } = usePage();
    const dateFormat = `${props.company?.date_format || "d-m-Y"} ${props.company?.time_format || "H:i"}`;

    const [createErrors, setCreateErrors] = useState<string[]>([]);
    const { mutate: mutateCreate, status: createStatus } = useApiMutate<
        TaskRequestPayload,
        Task,
        ApiResponse<Task>
    >(route("tasks.store"), "POST");

    const createTask = useCallback(
        // `onSuccess` receives the saved task so callers can chain follow-up
        // writes that need its id (checklist rows, file uploads).
        (input: TaskFormInput, onSuccess?: (task?: Task) => void) => {
            if (!input.title.trim()) {
                setCreateErrors(["Task title is required"]);
                return;
            }
            setCreateErrors([]);
            mutateCreate(buildPayload(input, dateFormat), {
                onSuccess: (response) => {
                    if (response?.data) {
                        setTasks((prev) => [response.data as Task, ...prev]);
                    }
                    onSuccess?.(response?.data as Task | undefined);
                },
                onError: (errorResponse) => {
                    const formatted = errorFormatter(errorResponse);
                    const responseErrors = Object.values(
                        formatted.errors || {},
                    ).flat();
                    setCreateErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to create task"],
                    );
                },
            });
        },
        [dateFormat, mutateCreate, setTasks],
    );

    const [updateErrors, setUpdateErrors] = useState<string[]>([]);
    const { mutate: mutateUpdate, status: updateStatus } = useApiMutate<
        TaskRequestPayload,
        Task,
        ApiResponse<Task>
    >(route("tasks.update", editingTaskId ?? 0), "PUT");

    const updateTask = useCallback(
        (taskId: number, input: TaskFormInput, onSuccess?: () => void) => {
            if (!input.title.trim()) {
                setUpdateErrors(["Task title is required"]);
                return;
            }
            setUpdateErrors([]);
            mutateUpdate(buildPayload(input, dateFormat), {
                onSuccess: (response) => {
                    if (response?.data) {
                        const updated = response.data as Task;
                        setTasks((prev) =>
                            prev.map((item) =>
                                item.id === taskId
                                    ? { ...item, ...updated }
                                    : item,
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
                    setUpdateErrors(
                        responseErrors.length > 0
                            ? responseErrors
                            : [formatted.message || "Failed to update task"],
                    );
                },
            });
        },
        [dateFormat, mutateUpdate, setTasks],
    );

    return {
        createTask,
        isCreating: isLoading({ status: createStatus }),
        createErrors,
        clearCreateErrors: () => setCreateErrors([]),

        updateTask,
        isUpdating: isLoading({ status: updateStatus }),
        updateErrors,
        clearUpdateErrors: () => setUpdateErrors([]),
    };
}
