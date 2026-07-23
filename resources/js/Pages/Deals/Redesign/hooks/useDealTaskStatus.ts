import { useState } from "react";
import { taskApi } from "@/lib/api/tasks";
import type { Task } from "@/Types/api/tasks";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

function todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Shared optimistic task-status updater for the deal workspace (Overview +
 * Tasks tabs). Patches both `status` and `board_column.slug` — the status
 * pill reads `board_column.slug` first, so patching only `status` would not
 * re-render the pill for tasks loaded with their board column relation.
 *
 * Also mirrors `TaskService::changeStatus`'s completion bookkeeping
 * (`completed_on` set on entering "done", cleared otherwise) locally.
 * `isTaskDone()` OR's on `Boolean(task.completed_on)`, so leaving a stale
 * `completed_on` from a prior "done" pass made a task un-completed on the
 * server still render struck-through and stuck under the "done" filter
 * until a full page reload.
 */
export default function useDealTaskStatus() {
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();
    const { setTasks } = useDealWorkspace();
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
                onSuccess: () =>
                    setTasks((prev) =>
                        prev.map((task) => {
                            if (task.id !== taskId) return task;
                            const boardColumn = (
                                task as Task & {
                                    board_column?: { slug?: string };
                                }
                            ).board_column;
                            return {
                                ...task,
                                status: slug,
                                completed_on:
                                    slug === "done" ? todayYmd() : undefined,
                                ...(boardColumn
                                    ? {
                                          board_column: {
                                              ...boardColumn,
                                              slug,
                                          },
                                      }
                                    : {}),
                            } as Task;
                        }),
                    ),
                onSettled: () => markPending(taskId, false),
            },
        );
    };

    const isPending = (taskId: number) => pendingTaskIds.has(taskId);

    return { setStatus, isPending };
}
