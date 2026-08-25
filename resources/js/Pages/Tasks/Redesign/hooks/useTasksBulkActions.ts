import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Task } from "@/Types/Task";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { createTaskBulkUpdateFields } from "../config/taskBulkUpdateFields";
import {
    buildBulkFilterScope,
    buildBulkTargetPayload,
    type BulkTarget,
} from "@/Features/BulkActions/bulkTarget";

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
    /** True once the user has extended selection to every row matching the filters, not just the loaded page. */
    selectAllMatching: boolean;
    /** Total rows matching the current filters (from the paginator), used when selectAllMatching is set. */
    matchingTotal: number;
    /** Active list filters — included in all-matching bulk POST bodies. */
    filters?: Record<string, unknown>;
    patchTasks: (updater: (prev: Task[]) => Task[]) => void;
    clearSelection: () => void;
}

/**
 * Bulk status / assignee / delete for the redesigned tasks workspace.
 * Same endpoint the deal/lead workspace task tabs use; patches local lists
 * for an explicit id selection, or reloads the list once when the target is
 * "all matching filters" — that set can include rows beyond the loaded
 * page, so there's nothing local to patch for those.
 */
export default function useTasksBulkActions({
    columns,
    categories,
    users,
    selected,
    selectedIds,
    selectAllMatching,
    matchingTotal,
    filters,
    patchTasks,
    clearSelection,
}: UseTasksBulkActionsArgs) {
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);

    const bulkFilterScope = useMemo(
        () => buildBulkFilterScope(filters),
        [filters],
    );

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        {
            row_ids?: string;
            select_all_matching?: boolean;
            action_type: string;
            status?: number;
            user_id?: number[];
        },
        unknown,
        ApiResponse<unknown>
    >(route("tasks.apply_quick_action"), "POST");
    const bulkBusy = isLoading({ status: bulkStatus });

    const bulkUpdateFields = useMemo(
        () => createTaskBulkUpdateFields({ columns, categories, users }),
        [columns, categories, users],
    );

    const target: BulkTarget = selectAllMatching
        ? { mode: "all_matching", count: matchingTotal }
        : { mode: "ids", ids: selectedIds, count: selectedIds.length };

    const bulkUpdateTarget = target;

    const reloadTaskList = () =>
        router.reload({
            only: ["tableTasks", "kanbanTasks", "taskQuickCounts", "stats"],
        });

    const bulkSetStatus = (column: TaskboardColumn) =>
        applyBulkAction(
            {
                ...buildBulkTargetPayload(target, bulkFilterScope),
                action_type: "change-status",
                status: column.id,
            },
            {
                onSuccess: () => {
                    if (selectAllMatching) {
                        reloadTaskList();
                        clearSelection();
                        return;
                    }
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
                ...buildBulkTargetPayload(target, bulkFilterScope),
                action_type: "change-assignee",
                user_id: [assigneeId],
            },
            {
                onSuccess: () => {
                    if (selectAllMatching) {
                        reloadTaskList();
                        clearSelection();
                        return;
                    }
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
            { ...buildBulkTargetPayload(target, bulkFilterScope), action_type: "delete" },
            {
                onSuccess: () => {
                    if (selectAllMatching) {
                        reloadTaskList();
                        setConfirmBulkDelete(false);
                        clearSelection();
                        return;
                    }
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
