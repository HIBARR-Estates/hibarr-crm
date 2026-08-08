import { useState } from "react";
import { taskApi } from "@/lib/api/tasks";
import type { Task } from "@/Types/api/tasks";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

function todayYmd(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Optimistic task-status updater for the lead workspace. Mirrors useDealTaskStatus. */
export default function useLeadTaskStatus() {
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();
    const { setTasks } = useLeadWorkspace();
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
