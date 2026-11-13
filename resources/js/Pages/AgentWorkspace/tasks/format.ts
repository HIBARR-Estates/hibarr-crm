import { dayKeyIn, hasDueTime, taskTimeState, type TimeState } from "@/Components/Redesign/agent";
import type { QueueTask } from "@/Types/personal-work";
import { wallTime } from "../today/format";
import type { TaskChip, TaskCounts } from "./types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

function dayDiff(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Which chip a task belongs to; null for one due after the next seven days. */
export function chipOf(task: QueueTask, state: TimeState, today: string): TaskChip | null {
    if (!task.due_date) return "none";
    if (state === "late") return "overdue";
    const day = task.due_date.slice(0, 10);
    if (day === today) return "today";
    const ahead = dayDiff(today, day);
    return ahead > 0 && ahead <= 7 ? "week" : null;
}

export interface TaskView {
    task: QueueTask;
    state: TimeState;
    chip: TaskChip | null;
}

/** Every task with its time state and chip worked out once. */
export function taskViews(tasks: QueueTask[], nowMs: number, timeZone: string): TaskView[] {
    const today = dayKeyIn(nowMs, timeZone);
    return tasks.map((task) => {
        const state = taskTimeState({ due_date: task.due_date, done: false }, nowMs, timeZone);
        return { task, state, chip: chipOf(task, state, today) };
    });
}

export function countViews(views: TaskView[]): TaskCounts {
    const counts: TaskCounts = { all: views.length, overdue: 0, today: 0, week: 0, none: 0 };
    for (const view of views) if (view.chip) counts[view.chip] += 1;
    return counts;
}

/** Due date first, no date last, then oldest id first: the server's own order. */
export function compareDue(a: QueueTask, b: QueueTask): number {
    if (!a.due_date !== !b.due_date) return a.due_date ? -1 : 1;
    return (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.id - b.id;
}

/** "Wed 11 Nov", with the time when the task has one. */
function shortDate(day: string, locale: string): string {
    const parts = new Intl.DateTimeFormat(locale || undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).formatToParts(
        new Date(`${day}T12:00:00Z`),
    );
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("weekday")} ${get("day")} ${get("month")}`;
}

/** "2 days late", "today 12:00", "Wed 11 Nov", "no date": a task's due chip. */
export function dueText(task: QueueTask, state: TimeState, nowMs: number, timeZone: string, locale: string, t: Translate): string {
    if (!task.due_date) return t("pages.agent_workspace.tasks.due.none");
    const today = dayKeyIn(nowMs, timeZone);
    const day = task.due_date.slice(0, 10);
    const timed = hasDueTime(task.due_date);
    const time = timed ? wallTime(task.due_date) : "";
    const key = "pages.agent_workspace.tasks.due";

    if (state === "late") {
        const late = dayDiff(day, today);
        if (late <= 0) return t(`${key}.late_since`, { time });
        return late === 1 ? t(`${key}.late_one`) : t(`${key}.late_many`, { count: late });
    }
    if (day === today) return timed ? t(`${key}.today_at`, { time }) : t(`${key}.today`);
    return timed ? `${shortDate(day, locale)} ${time}` : shortDate(day, locale);
}

