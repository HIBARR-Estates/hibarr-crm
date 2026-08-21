import { useMemo, useState } from "react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/Task";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { createTaskBulkUpdateFields } from "../config/taskBulkUpdateFields";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";

interface UserOption {
    id: number;
    name: string;
    image?: string;
}

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UseTasksBulkActionsArgs {
    columns: TaskboardColumn[];
    categories: CategoryOption[];
    users: UserOption[];
    selected: Set<number>;
    selectedIds: number[];
    patchTasks: (updater: (prev: Task[]) => Task[]) => void;
    clearSelection: () => void;
}

/**
 * Bulk status / assignee / delete for the redesigned tasks workspace.
 * Same endpoint the deal/lead workspace task tabs use; patches local
 * lists instead of reloading.
 */
export default function useTasksBulkActions({
    columns,
    categories,
    users,
    selected,
    selectedIds,
    patchTasks,
    clearSelection,
}: UseTasksBulkActionsArgs) {
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        {
            row_ids: string;
            action_type: string;
            status?: number;
            user_id?: number[];
        },
        unknown,
        ApiResponse<unknown>
    >("/account/tasks/apply-quick-action", "POST");
    const bulkBusy = isLoading({ status: bulkStatus });

    const bulkUpdateFields = useMemo(
        () => createTaskBulkUpdateFields({ columns, categories, users }),
        [columns, categories, users],
    );

    const bulkUpdateTarget: BulkTarget = {
        mode: "ids",
        ids: selectedIds,
        count: selectedIds.length,
    };

    const bulkSetStatus = (column: TaskboardColumn) =>
        applyBulkAction(
            {
                row_ids: selectedIds.join(","),
                action_type: "change-status",
                status: column.id,
            },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.map((task) =>
                            selected.has(task.id)
                                ? {
                                      ...task,
                                      status: column.slug,
                                      board_column_id: column.id,
                                      board_column: {
                                          id: column.id,
                                          column_name: column.column_name,
                                          slug: column.slug,
                                          label_color: column.label_color,
                                      },
                                      completed_on:
                                          column.slug === "done"
                                              ? new Date()
                                                    .toISOString()
                                                    .slice(0, 10)
                                              : undefined,
                                  }
                                : task,
                        ),
                    );
                    clearSelection();
                },
            },
        );

    const bulkReassign = (assigneeId: number) => {
        const assignee = users.find((user) => user.id === assigneeId);
        applyBulkAction(
            {
                row_ids: selectedIds.join(","),
                action_type: "change-assignee",
                user_id: [assigneeId],
            },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.map((task) =>
                            selected.has(task.id)
                                ? {
                                      ...task,
                                      users: assignee
                                          ? [
                                                {
                                                    id: assignee.id,
                                                    name: assignee.name,
                                                    image: assignee.image,
                                                },
                                            ]
                                          : [],
                                  }
                                : task,
                        ),
                    );
                    clearSelection();
                },
            },
        );
    };

    const bulkDelete = () =>
        applyBulkAction(
            { row_ids: selectedIds.join(","), action_type: "delete" },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.filter((task) => !selected.has(task.id)),
                    );
                    setConfirmBulkDelete(false);
                    clearSelection();
                },
            },
        );

    return {
        bulkBusy,
        bulkSetStatus,
        bulkReassign,
        bulkDelete,
        confirmBulkDelete,
        setConfirmBulkDelete,
        bulkUpdateOpen,
        setBulkUpdateOpen,
        bulkUpdateFields,
        bulkUpdateTarget,
    };
}
