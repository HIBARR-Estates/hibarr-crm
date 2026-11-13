import { useCallback, useEffect, useMemo, useState } from "react";
import { message } from "antd";
import useTaskStatus from "@/Hooks/useTaskStatus";
import useTaskReschedule from "@/Components/Redesign/hooks/useTaskReschedule";
import useTranslation from "@/Hooks/useTranslation";
import type { Task } from "@/Types/api/tasks";
import type { QueueTask } from "@/Types/personal-work";
import { isTaskDone } from "../today/useTodayWork";
import { compareDue } from "./format";

type Override = { kind: "done" } | { kind: "due"; date: string };

/**
 * The task list with every click applied on the spot: ticking a task takes it
 * off the list and rescheduling moves it, then the existing endpoints are
 * called. A failure puts the row back and says so; nothing reloads the page.
 * An override stays until the server's copy agrees with it, so a deferred
 * group landing mid-request cannot undo a click.
 */
export default function useTaskListWork(tasks: QueueTask[] | undefined, onSaved?: () => void) {
    const { t } = useTranslation();
    const [overrides, setOverrides] = useState<Record<number, Override>>({});

    const clear = useCallback((taskId: number) => {
        setOverrides((prev) => {
            if (!(taskId in prev)) return prev;
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    }, []);

    // Drop overrides the server now agrees with (or whose task it no longer lists).
    useEffect(() => {
        if (!tasks) return;
        const server = new Map(tasks.map((task) => [task.id, task]));
        setOverrides((prev) => {
            let changed = false;
            const next: Record<number, Override> = {};
            for (const [key, override] of Object.entries(prev)) {
                const row = server.get(Number(key));
                const settled = override.kind === "done" ? !row || isTaskDone(row) : row?.due_date?.slice(0, 10) === override.date;
                if (settled) changed = true;
                else next[Number(key)] = override;
            }
            return changed ? next : prev;
        });
    }, [tasks]);

    const { setStatus, isPending: isStatusPending } = useTaskStatus(
        (taskId, slug) => {
            // A tick is already on screen; any other status (the task modal's dropdown) is not.
            if (slug !== "done") clear(taskId);
            onSaved?.();
        },
        (taskId, slug) => {
            if (slug === "done") {
                clear(taskId);
                message.error(t("pages.tasks.feedback.complete_failed"));
            }
        },
    );
    const { reschedule, isPending: isReschedulePending } = useTaskReschedule(() => onSaved?.(), clear);

    const complete = useCallback(
        (task: Pick<Task, "id">) => {
            setOverrides((prev) => ({ ...prev, [task.id]: { kind: "done" } }));
            setStatus(task.id, "done");
        },
        [setStatus],
    );

    const moveTo = useCallback(
        (task: Pick<Task, "id">, date: string) => {
            setOverrides((prev) => ({ ...prev, [task.id]: { kind: "due", date } }));
            void reschedule(task.id, date);
        },
        [reschedule],
    );

    const rows = useMemo<QueueTask[] | undefined>(() => {
        if (!tasks) return tasks;
        if (Object.keys(overrides).length === 0) return tasks;
        const out: QueueTask[] = [];
        let moved = false;
        for (const task of tasks) {
            const override = overrides[task.id];
            if (override?.kind === "done") continue;
            if (override?.kind === "due") {
                moved = true;
                out.push({ ...task, due_date: `${override.date} 00:00:00` });
            } else out.push(task);
        }
        return moved ? out.sort(compareDue) : out;
    }, [tasks, overrides]);

    return { rows, complete, moveTo, setStatus, isStatusPending, isReschedulePending, clear };
}
