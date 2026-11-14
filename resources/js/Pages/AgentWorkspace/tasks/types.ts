import type { QueueTask } from "@/Types/personal-work";

/** TaskController@agentIndex: the open tasks of one scope, plus how many there are in all. */
export interface TasksPayload {
    items: QueueTask[];
    total: number;
}

/** My tasks (assigned to me), Assigned by me, or the whole team. */
export type TaskScope = "mine" | "byme" | "team";

/** Where a task stands against the viewer's calendar. */
export type TaskChip = "overdue" | "today" | "week" | "none";

export interface TaskCounts {
    all: number;
    overdue: number;
    today: number;
    week: number;
    none: number;
}

export interface TaskOption {
    id: number;
    category_name?: string;
}
