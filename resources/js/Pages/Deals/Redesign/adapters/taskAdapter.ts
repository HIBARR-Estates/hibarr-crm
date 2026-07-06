import type { Task } from "@/Types/api/tasks";

export interface WorkspaceTaskPreview {
    id: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: Date | null;
    dueDateLabel: string;
    isOpen: boolean;
}

export interface WorkspaceTaskListItem extends WorkspaceTaskPreview {
    assigneeName: string;
    assigneeInitials: string;
}

const PRIORITY_WEIGHT: Record<WorkspaceTaskPreview["priority"], number> = {
    high: 3,
    medium: 2,
    low: 1,
};

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
});

function parseDueDate(value: string | undefined): Date | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDueDate(date: Date | null): string {
    return date ? DATE_FORMAT.format(date) : "No due date";
}

function isOpenTask(task: Task): boolean {
    const status = task.status?.toLowerCase();
    const completed = status === "completed" || status === "done" || status === "closed";
    return !completed && !task.completed_on;
}

export function getTaskPriorityWeight(priority: WorkspaceTaskPreview["priority"]): number {
    return PRIORITY_WEIGHT[priority] ?? 0;
}

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function toWorkspaceTaskPreview(task: Task): WorkspaceTaskPreview {
    const dueDate = parseDueDate(task.due_date);
    const priority = (task.priority || "medium") as WorkspaceTaskPreview["priority"];

    return {
        id: task.id,
        title: task.heading?.trim() || "Untitled task",
        description: task.description?.trim() || "No description",
        priority,
        dueDate,
        dueDateLabel: formatDueDate(dueDate),
        isOpen: isOpenTask(task),
    };
}

export function toWorkspaceTaskListItem(task: Task): WorkspaceTaskListItem {
    const preview = toWorkspaceTaskPreview(task);
    const assigneeName = task.users?.[0]?.name?.trim() || "Unassigned";

    return {
        ...preview,
        assigneeName,
        assigneeInitials: initialsFromName(assigneeName),
    };
}
