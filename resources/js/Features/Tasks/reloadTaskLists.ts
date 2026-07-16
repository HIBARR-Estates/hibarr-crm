import { router } from "@inertiajs/react";

/**
 * Partial Inertia reload keys for task lists across pages that embed TasksTab /
 * SaveTaskModal / TaskDetailsModal. Prefer this over bare `router.reload()` so
 * deferred props like notes/meetings on lead/deal show are not remounted.
 */
export const TASK_LIST_RELOAD_KEYS = [
    "tasks",
    "tableTasks",
    "kanbanTasks",
    "stats",
    "overviewMetrics",
    "taskBoardColumns",
] as const;

export function reloadTaskLists(
    extraKeys: string[] = [],
): void {
    router.reload({
        only: [...TASK_LIST_RELOAD_KEYS, ...extraKeys],
    });
}
