import type { Task } from "@/Types/Task";

/**
 * Scoped task permission checks — matches legacy TasksKanban / Columns.
 * Kept free of React so list, board, and detail can share the same gates.
 */

export interface TaskPermissionSet {
    add_tasks?: string;
    edit_tasks?: string;
    delete_tasks?: string;
    change_status?: string;
    add_task_comments?: string;
    delete_task_comments?: string;
    view_tasks?: string;
    view_task_category?: string;
}

const WRITE_SCOPES = ["all", "added", "owned", "both"] as const;

export function canAdd(permission: string | undefined): boolean {
    return WRITE_SCOPES.includes(
        (permission ?? "") as (typeof WRITE_SCOPES)[number],
    );
}

export function hasAnyDeletePermission(scope: string | undefined): boolean {
    return canAdd(scope);
}

export function hasTaskScopePermission(
    task: Task,
    scope: string | undefined,
    userId: number,
): boolean {
    if (scope === "all") return true;
    if (!scope || scope === "none") return false;
    const isCreator = task.added_by === userId;
    const isAssignee = task.users?.some((user) => user.id === userId) ?? false;
    if (scope === "added") return isCreator;
    if (scope === "owned") return isAssignee;
    if (scope === "both") return isCreator || isAssignee;
    return false;
}

/** Whether the current user may move/complete this task (change_status scope). */
export function canChangeStatus(
    task: Task,
    permissions: TaskPermissionSet | undefined,
    userId: number,
): boolean {
    const scope = permissions?.change_status ?? permissions?.edit_tasks;
    return hasTaskScopePermission(task, scope, userId);
}

export function canDeleteTask(
    task: Task,
    permissions: TaskPermissionSet | undefined,
    userId: number,
): boolean {
    return hasTaskScopePermission(task, permissions?.delete_tasks, userId);
}

/**
 * Edit access for the checklist (add/toggle/remove). Follows edit_tasks even
 * when change_status is configured narrower — canChangeStatus falls back to
 * edit_tasks only when change_status is unset, not when it's just tighter.
 */
export function canEditTask(
    task: Task,
    permissions: TaskPermissionSet | undefined,
    userId: number,
): boolean {
    return hasTaskScopePermission(task, permissions?.edit_tasks, userId);
}

export function canCommentOnTask(
    task: Task,
    permissions: TaskPermissionSet | undefined,
    userId: number,
): boolean {
    return hasTaskScopePermission(
        task,
        permissions?.add_task_comments,
        userId,
    );
}
