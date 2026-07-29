import type { Task } from "@/Types/api/tasks";
import { parseTaskDateTime } from "@/lib/taskDateTime";
import { formatDateWithTime } from "./dateFormat";
import { initialsFromName } from "./initials";

export interface WorkspaceTaskPreview {
    id: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high";
    dueDate: Date | null;
    dueDateLabel: string;
    isOpen: boolean;
}

export interface WorkspaceTaskAssignee {
    id: number;
    name: string;
    initials: string;
}

export interface WorkspaceTaskListItem extends WorkspaceTaskPreview {
    assigneeName: string;
    assigneeInitials: string;
    assignees: WorkspaceTaskAssignee[];
    /** Plain-text description, empty when the task has none (v2.2 hides it). */
    descriptionText: string;
}

const PRIORITY_WEIGHT: Record<WorkspaceTaskPreview["priority"], number> = {
    high: 3,
    medium: 2,
    low: 1,
};


function parseDueDate(value: string | undefined): Date | null {
    return parseTaskDateTime(value);
}

function formatDueDate(date: Date | null): string {
    // Empty, not English - the render site supplies the localised label.
    return date ? formatDateWithTime(date) : "";
}

function isOpenTask(task: Task): boolean {
    const status = task.status?.toLowerCase();
    const completed = status === "completed" || status === "done" || status === "closed";
    return !completed && !task.completed_on;
}

export function getTaskPriorityWeight(priority: WorkspaceTaskPreview["priority"]): number {
    return PRIORITY_WEIGHT[priority] ?? 0;
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

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function toWorkspaceTaskListItem(task: Task): WorkspaceTaskListItem {
    const preview = toWorkspaceTaskPreview(task);
    const assigneeName = task.users?.[0]?.name?.trim() || "Unassigned";
    const assignees = (task.users ?? []).map((user) => ({
        id: user.id,
        name: user.name?.trim() || "Unknown",
        initials: initialsFromName(user.name),
    }));

    return {
        ...preview,
        assigneeName,
        assigneeInitials: initialsFromName(assigneeName),
        assignees,
        descriptionText: stripHtml(task.description ?? ""),
    };
}
