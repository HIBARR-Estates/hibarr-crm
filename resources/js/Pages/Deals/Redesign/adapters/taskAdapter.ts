import type { Task } from "@/Types/api/tasks";
import type { IntegrationOrigin } from "@/Types/api/note";
import {
    formatTaskDateWithCompanyTime,
    parseTaskDateTime,
} from "@/lib/taskDateTime";
import { initialsFromName } from "./initials";

export interface WorkspaceTaskPreview {
    id: number;
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    dueDate: Date | null;
    dueDateLabel: string;
    isOpen: boolean;
    integrationOrigin: IntegrationOrigin | null;
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
    urgent: 5,
    highest: 4,
    high: 3,
    medium: 2,
    low: 1,
};


/**
 * The due date for comparison/sorting — a Date in the viewer's own zone.
 */
function parseDueDate(value: string | undefined): Date | null {
    return parseTaskDateTime(value);
}

/**
 * Empty, not English - the render site supplies the localised label.
 *
 * Formatted from the raw wall-clock string rather than from `dueDate`: a Date
 * built in the browser's own zone cannot represent a wall-clock time that does
 * not exist there (the DST spring-forward hour), and it silently reads an hour
 * later — the label would disagree with the time the task is actually stored
 * at. Same reason `dueDate` and `dueDateLabel` are produced independently.
 */
function formatDueDate(dueDate: string | null | undefined): string {
    return dueDate
        ? formatTaskDateWithCompanyTime(dueDate, { fallback: "" })
        : "";
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
        dueDateLabel: formatDueDate(task.due_date),
        isOpen: isOpenTask(task),
        integrationOrigin: task.integration_origin ?? null,
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
