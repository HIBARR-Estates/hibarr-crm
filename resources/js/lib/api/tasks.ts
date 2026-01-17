import { useApiMutate, useApiQuery } from "@/lib/api/client";
import { Task, TaskPayload, TaskBulkActionPayload } from "@/Types/Task";
import { ApiResponse } from "./types";

// API functions for tasks
export const taskApi = {
    // Queries
    useGetTasks: (params: any) =>
        useApiQuery<Task[]>({ path: "/tasks", params }),

    useGetTask: (id: number) => useApiQuery<Task>({ path: `/tasks/${id}` }),

    // Mutations
    useCreateTask: () =>
        useApiMutate<TaskPayload, Task, ApiResponse<Task>>("/tasks", "POST"),

    useUpdateTask: (id: number) =>
        useApiMutate<TaskPayload, Task, ApiResponse<Task>>(
            `/tasks/${id}`,
            "PUT"
        ),

    useDeleteTask: (id: number) =>
        useApiMutate<void, void, ApiResponse<void>>(`/tasks/${id}`, "DELETE"),

    useUpdateStatus: () =>
        useApiMutate<
            { status: string; taskId: number },
            { status: string; data?: Task; clockHtml?: string },
            ApiResponse<{ status: string; data?: Task; clockHtml?: string }>
        >("/tasks/change-status", "POST"),

    useBulkAction: () =>
        useApiMutate<TaskBulkActionPayload, any, ApiResponse<any>>(
            "/tasks/bulk-action", // Assuming this endpoint needs to be mapped or created if not existing standard
            // Based on legacy controller, it might be separate endpoints like changeBulkStatus or deleteRecords
            // We'll stick to legacy compatible endpoints for now or the new one if created.
            // The prompt architecture suggests 'tasks/bulk-action'. Let's assume we might need to route this correctly or create it.
            // For now, mapping to what likely exists or will be created:
            "POST"
        ),
};
