import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export interface TaskCheckpoint {
    id: number;
    title: string;
    status: "complete" | "incomplete" | string;
}

/**
 * Checkpoints are the task's sub-tasks. The existing SubTaskController
 * endpoints still render Blade partials back, so the returned `view` payload
 * is ignored and local state is patched instead.
 *
 * `onItemsChange` (optional) is fired whenever `items` changes, so the caller
 * can mirror the checklist back into the source task list state — without it,
 * a delete/add/toggle only lives in this hook's local state and reverts to
 * the stale list data the next time the same task is reopened.
 */
export default function useTaskCheckpoints(
    taskId: number | null,
    initial: TaskCheckpoint[] | undefined,
    onItemsChange?: (items: TaskCheckpoint[]) => void,
) {
    const [items, setItems] = useState<TaskCheckpoint[]>(initial ?? []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Re-seed whenever a different task opens.
    useEffect(() => {
        setItems(initial ?? []);
        setError(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]);

    const onItemsChangeRef = useRef(onItemsChange);
    useEffect(() => {
        onItemsChangeRef.current = onItemsChange;
    });
    useEffect(() => {
        onItemsChangeRef.current?.(items);
    }, [items]);

    const toggle = useCallback(async (item: TaskCheckpoint) => {
        const nextStatus =
            item.status === "complete" ? "incomplete" : "complete";

        // Optimistic: the checkbox should feel instant.
        setItems((prev) =>
            prev.map((entry) =>
                entry.id === item.id ? { ...entry, status: nextStatus } : entry,
            ),
        );

        try {
            await axios.post(route("sub_tasks.change_status"), {
                subTaskId: item.id,
                status: nextStatus,
            });
        } catch {
            setError("Couldn't update that checklist item");
            setItems((prev) =>
                prev.map((entry) =>
                    entry.id === item.id
                        ? { ...entry, status: item.status }
                        : entry,
                ),
            );
        }
    }, []);

    const add = useCallback(
        async (title: string): Promise<boolean> => {
            if (taskId === null || !title.trim()) return false;
            setSaving(true);
            setError(null);
            try {
                const response = await axios.post(route("sub-tasks.store"), {
                    task_id: taskId,
                    title: title.trim(),
                    description: "",
                });
                // The endpoint answers with a rendered Blade view plus the new
                // row id under `subTaskID` — without it the row would carry a
                // placeholder id and then fail to toggle or delete.
                const payload = response.data?.data ?? response.data ?? {};
                const createdId = Number(
                    payload.subTaskID ?? payload.subTaskId,
                );
                if (!createdId) {
                    setError("Couldn't add that checklist item");
                    return false;
                }
                setItems((prev) => [
                    ...prev,
                    {
                        id: createdId,
                        title: title.trim(),
                        status: "incomplete",
                    },
                ]);
                return true;
            } catch {
                setError("Couldn't add that checklist item");
                return false;
            } finally {
                setSaving(false);
            }
        },
        [taskId],
    );

    const remove = useCallback(
        async (id: number) => {
            const previous = items;
            setItems((prev) => prev.filter((entry) => entry.id !== id));
            try {
                await axios.delete(route("sub-tasks.destroy", id));
            } catch {
                setError("Couldn't remove that checklist item");
                setItems(previous);
            }
        },
        [items],
    );

    return { items, saving, error, toggle, add, remove };
}
