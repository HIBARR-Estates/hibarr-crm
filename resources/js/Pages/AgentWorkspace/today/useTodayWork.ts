import { useCallback, useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import useTaskStatus, { applyTaskStatus } from "@/Hooks/useTaskStatus";
import useTaskReschedule from "@/Components/Redesign/hooks/useTaskReschedule";
import useMeetingStatus from "@/Components/Redesign/hooks/useMeetingStatus";
import { dayKeyIn } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { Task } from "@/Types/api/tasks";
import type { QueueTask, ScheduleEntry } from "@/Types/personal-work";
import type { PersonalQueue, TodaySchedule } from "./types";

/** Deferred groups a task change can move. */
export const TASK_RELOAD_KEYS = ["queue", "schedule", "stats"];
/** Module scope: useMeetingReschedule memoizes on this array. */
export const MEETING_RELOAD_KEYS = ["schedule", "stats"];

type TaskOverride = { kind: "done" } | { kind: "due"; date: string };

export function isTaskDone(task: Pick<Task, "status" | "board_column" | "completed_on">): boolean {
    const slug = task.board_column?.slug ?? task.status;
    return slug === "done" || Boolean(task.completed_on);
}

function bucketOf(task: QueueTask, today: string): "overdue" | "today" | "later" {
    const day = task.due_date?.slice(0, 10) ?? "";
    if (day && day < today) return "overdue";
    return day === today ? "today" : "later";
}

function dayDiff(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Today's tasks and meetings with every click applied on the spot.
 *
 * Ticking, rescheduling and marking held change the screen first and then
 * call the existing endpoints; a failure puts the row back and says so. None
 * of them reload the page. An override stays until the server's copy agrees
 * with it, so a deferred group landing mid-request can't undo a click.
 */
export default function useTodayWork({
    queue,
    schedule,
    agenda,
    windowDays,
    timeZone,
    nowMs,
    onSaved,
}: {
    queue?: PersonalQueue;
    schedule?: TodaySchedule;
    /** The agenda's current range (same row shapes as the schedule). */
    agenda?: TodaySchedule;
    windowDays: number;
    timeZone: string;
    nowMs: number;
    /** Called once a change is saved, so cached data outside the deferred props can re-read. */
    onSaved?: () => void;
}) {
    const { t } = useTranslation();
    const [taskOverrides, setTaskOverrides] = useState<Record<number, TaskOverride>>({});
    const [heldIds, setHeldIds] = useState<ReadonlySet<number>>(() => new Set());
    const today = dayKeyIn(nowMs, timeZone);

    const clearTask = useCallback((taskId: number) => {
        setTaskOverrides((prev) => {
            if (!(taskId in prev)) return prev;
            const next = { ...prev };
            delete next[taskId];
            return next;
        });
    }, []);

    const reloadTasks = useCallback(() => router.reload({ only: TASK_RELOAD_KEYS }), []);

    // Drop overrides the server now agrees with.
    useEffect(() => {
        const serverTasks = new Map<number, QueueTask>();
        for (const task of [...(agenda?.tasks ?? []), ...(queue?.tasks ?? []), ...(schedule?.tasks ?? [])]) {
            serverTasks.set(task.id, task);
        }

        setTaskOverrides((prev) => {
            let changed = false;
            const next: Record<number, TaskOverride> = {};
            for (const [key, override] of Object.entries(prev)) {
                const server = serverTasks.get(Number(key));
                const settled =
                    override.kind === "done"
                        ? !server || isTaskDone(server)
                        : server?.due_date?.slice(0, 10) === override.date;
                if (settled) changed = true;
                else next[Number(key)] = override;
            }
            return changed ? next : prev;
        });
        setHeldIds((prev) => {
            if (prev.size === 0) return prev;
            const settled = new Set(
                [...(schedule?.meetings ?? []), ...(agenda?.meetings ?? [])]
                    .filter((m) => m.status === "completed")
                    .map((m) => m.id),
            );
            const next = new Set([...prev].filter((id) => !settled.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [queue, schedule, agenda]);

    const { setStatus, isPending: isStatusPending } = useTaskStatus(
        (taskId, slug) => {
            // Ticks are already on screen. Any other status (the classic task
            // modal's dropdown) is not, so that one re-reads the lists.
            if (slug !== "done") {
                clearTask(taskId);
                reloadTasks();
            }
            onSaved?.();
        },
        (taskId, slug) => {
            if (slug === "done") {
                clearTask(taskId);
                message.error(t("pages.tasks.feedback.complete_failed"));
            }
        },
    );

    const { reschedule, isPending: isReschedulePending } = useTaskReschedule(
        () => onSaved?.(),
        (taskId) => clearTask(taskId),
    );

    const { markHeld: postHeld, isPending: isHeldPending } = useMeetingStatus(
        () => onSaved?.(),
        MEETING_RELOAD_KEYS,
        (followUpId) =>
            setHeldIds((prev) => {
                const next = new Set(prev);
                next.delete(followUpId);
                return next;
            }),
    );

    const completeTask = useCallback(
        (task: Task) => {
            setTaskOverrides((prev) => ({ ...prev, [task.id]: { kind: "done" } }));
            setStatus(task.id, "done");
        },
        [setStatus],
    );

    const rescheduleTask = useCallback(
        (task: Task, date: string) => {
            setTaskOverrides((prev) => ({ ...prev, [task.id]: { kind: "due", date } }));
            void reschedule(task.id, date);
        },
        [reschedule],
    );

    const markHeld = useCallback(
        (followUpId: number) => {
            setHeldIds((prev) => new Set(prev).add(followUpId));
            void postHeld(followUpId);
        },
        [postHeld],
    );

    const patch = useCallback(
        (task: QueueTask): QueueTask => {
            const override = taskOverrides[task.id];
            if (!override) return task;
            if (override.kind === "done") return applyTaskStatus(task, "done") as QueueTask;
            return {
                ...task,
                due_date: `${override.date} 00:00:00`,
                days_overdue: Math.max(0, dayDiff(override.date, today)),
            };
        },
        [taskOverrides, today],
    );

    const visibleQueue = useMemo<PersonalQueue | undefined>(() => {
        if (!queue) return queue;
        if (Object.keys(taskOverrides).length === 0) return queue;

        const windowEnd = dayKeyIn(nowMs + windowDays * 86_400_000, timeZone);
        const counts = { ...queue.counts };
        let moved = false;

        const tasks = queue.tasks.flatMap((task) => {
            const override = taskOverrides[task.id];
            if (!override) return [task];
            if (isTaskDone(task)) return [task];

            counts[bucketOf(task, today)] -= 1;
            const patched = patch(task);
            if (override.kind === "due") {
                moved = true;
                // Moved past the window this queue covers: gone, like a row
                // the server never sent.
                if (override.date > windowEnd) return [];
                counts[bucketOf(patched, today)] += 1;
            }
            return [patched];
        });

        if (moved) tasks.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

        return {
            ...queue,
            tasks,
            counts: {
                overdue: Math.max(0, counts.overdue),
                today: Math.max(0, counts.today),
                later: Math.max(0, counts.later),
            },
        };
    }, [queue, taskOverrides, patch, nowMs, windowDays, timeZone, today]);

    const visibleSchedule = useMemo<TodaySchedule | undefined>(() => {
        if (!schedule) return schedule;
        if (Object.keys(taskOverrides).length === 0 && heldIds.size === 0) return schedule;

        return {
            meetings: schedule.meetings.map((meeting): ScheduleEntry =>
                heldIds.has(meeting.id) ? { ...meeting, status: "completed" } : meeting,
            ),
            tasks: schedule.tasks
                .map(patch)
                // Rescheduled off today: no longer on today's schedule.
                .filter((task) => task.due_date?.slice(0, 10) === today),
        };
    }, [schedule, taskOverrides, heldIds, patch, today]);

    const visibleAgenda = useMemo<TodaySchedule | undefined>(() => {
        if (!agenda) return agenda;
        if (Object.keys(taskOverrides).length === 0 && heldIds.size === 0) return agenda;
        return {
            meetings: agenda.meetings.map((meeting): ScheduleEntry =>
                heldIds.has(meeting.id) ? { ...meeting, status: "completed" } : meeting,
            ),
            // A moved task keeps its row; the agenda files it under its new day.
            tasks: agenda.tasks.map(patch),
        };
    }, [agenda, taskOverrides, heldIds, patch]);

    return {
        queue: visibleQueue,
        schedule: visibleSchedule,
        agenda: visibleAgenda,
        completeTask,
        rescheduleTask,
        markHeld,
        setStatus,
        isStatusPending,
        isReschedulePending,
        isHeldPending,
        clearTask,
        reloadTasks,
    };
}
