import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { App } from "antd";
import { router } from "@inertiajs/react";
import { ApiResponse } from "@/lib/api/types";

interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
}

interface CreateTaskData {
    heading: string;
    description?: string;
    start_date: string;
    due_date?: string;
    priority: "low" | "medium" | "high";
    project_id?: number;
    category_id?: number;
    user_ids?: number[];
    task_labels?: number[];
    board_column_id?: number;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    without_duedate?: boolean;
}

interface UpdateTaskData extends CreateTaskData {
    id: number;
}

interface BulkActionData {
    action_type: "delete" | "change-status" | "milestone";
    row_ids: string;
    status?: number;
    milestone?: number;
}

export const useTaskMutations = ({ data }: { data?: Task } = {}) => {
    const { message } = App.useApp();

    // Create Task Mutation
    const createTaskMutation = useApiMutate<
        CreateTaskData,
        Task,
        ApiResponse<Task>
    >(route("tasks.store"), "POST");

    // Update Task Mutation
    const updateTaskMutation = useApiMutate<
        UpdateTaskData,
        Task,
        ApiResponse<Task>
    >(route("tasks.update", data?.id), "PUT");

    // Delete Task Mutation
    const deleteTaskMutation = useApiMutate<
        { id: number },
        null,
        ApiResponse<null>
    >(route("tasks.destroy", data?.id), "DELETE");

    // Bulk Action Mutation
    const bulkActionMutation = useApiMutate<
        BulkActionData,
        null,
        ApiResponse<null>
    >(route("tasks.apply_quick_action"), "POST");

    // Change Task Status Mutation
    const changeStatusMutation = useApiMutate<
        { taskId: number; status: string },
        null,
        ApiResponse<null>
    >(route("tasks.change_status"), "POST");

    // Change Task Milestone Mutation
    const changeMilestoneMutation = useApiMutate<
        { taskId: number; milestone_id: number },
        null,
        ApiResponse<null>
    >(route("tasks.change_milestone"), "POST");

    // Task actions
    const createTask = () => {
        return createTaskMutation.mutate;
    };

    const updateTask = () => {
        return updateTaskMutation.mutate;
    };
    const deleteTask = () => {
        return deleteTaskMutation.mutate;
    };

    const bulkAction = (data: BulkActionData) => {
        bulkActionMutation.mutate(data);
    };

    const changeTaskStatus = (taskId: number, status: string) => {
        changeStatusMutation.mutate({
            taskId,
            status,
        });
    };

    const changeTaskMilestone = (taskId: number, milestone_id: number) => {
        changeMilestoneMutation.mutate({
            taskId,
            milestone_id,
        });
    };

    // Navigation helpers
    // TODO: This should be refactored to show as drawers instead of full page navigation
    const viewTask = (taskId: number) => {
        router.visit(route("tasks.show", taskId));
    };

    const editTask = (taskId: number) => {
        router.visit(route("tasks.edit", taskId));
    };

    const duplicateTaskNavigation = (taskId: number) => {
        router.visit(route("tasks.create", { duplicate_task: taskId }));
    };

    return {
        // Mutations
        createTaskMutation,
        updateTaskMutation,
        deleteTaskMutation,
        bulkActionMutation,
        changeStatusMutation,
        changeMilestoneMutation,

        // Actions
        createTask,
        updateTask,
        deleteTask,
        bulkAction,
        changeTaskStatus,
        changeTaskMilestone,

        // Navigation
        viewTask,
        editTask,
        duplicateTaskNavigation,

        // Loading states
        isCreating: createTaskMutation.isPending,
        isUpdating: updateTaskMutation.isPending,
        isDeleting: deleteTaskMutation.isPending,
        isBulkActionPending: bulkActionMutation.isPending,
        isChangingStatus: changeStatusMutation.isPending,
        isChangingMilestone: changeMilestoneMutation.isPending,
    };
};
