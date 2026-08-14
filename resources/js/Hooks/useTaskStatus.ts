import { useState } from "react";
import { taskApi } from "@/lib/api/tasks";
import type { Task } from "@/Types/api/tasks";

function todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Apply a status change to a task locally.
 *
 * `tasks.change_status` returns no task payload, so every caller has to mirror
 * `TaskService::changeStatus`'s bookkeeping itself. Two things it must get
 * right, both learned the hard way:
 *
 * - Patch `board_column.slug` as well as `status`. The status pill reads
 *   `board_column.slug` first, so patching only `status` leaves the pill stale
 *   for any task loaded with its board column relation.
 * - Clear `completed_on` when leaving "done". `isTaskDone()` ORs on
 *   `Boolean(task.completed_on)`, so a stale stamp from a previous "done" pass
 *   kept a re-opened task struck through and filed under the done filter until
 *   a full page reload.
 */
export function applyTaskStatus(task: Task, slug: string): Task {
    return {
        ...task,
        status: slug,
        completed_on: slug === "done" ? todayYmd() : undefined,
        ...(task.board_column
            ? { board_column: { ...task.board_column, slug } }
            : {}),
    };
}

/**
 * Optimistic task-status updater.
 *
 * The caller supplies what to do on success, because the three surfaces that
 * use this hold their tasks differently: the deal and lead workspaces patch
 * their context, the dashboard re-resolves a deferred prop.
 */
export default function useTaskStatus(
    onChanged: (taskId: number, slug: string) => void,
) {
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();
    const [pendingTaskIds, setPendingTaskIds] = useState<Set<number>>(
        () => new Set(),
    );

    const markPending = (taskId: number, pending: boolean) => {
        setPendingTaskIds((prev) => {
            const next = new Set(prev);
            if (pending) next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    };

    const setStatus = (taskId: number, slug: string) => {
        markPending(taskId, true);
        updateTaskStatus(
            { taskId, status: slug },
            {
                onSuccess: () => onChanged(taskId, slug),
                onSettled: () => markPending(taskId, false),
            },
        );
    };

    const isPending = (taskId: number) => pendingTaskIds.has(taskId);

    return { setStatus, isPending };
}
