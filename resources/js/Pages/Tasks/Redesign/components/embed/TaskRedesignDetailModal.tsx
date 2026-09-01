import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/Task";
import { toTaskViewModel } from "../../adapters/taskViewModel";
import {
    asCommentDeleteScope,
    canCommentOnTask,
    canEditTask,
    type TaskPermissionSet,
} from "../../adapters/taskPermissions";
import TaskDetailModal from "../TaskDetailModal";

interface PersonOption {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface TaskRedesignDetailModalProps {
    task: Task | null;
    columns: TaskboardColumn[];
    permissions: TaskPermissionSet | undefined;
    currentUser: { id: number; name: string; image?: string | null };
    people: PersonOption[];
    toggling?: boolean;
    onClose: () => void;
    onEdit: () => void;
    onToggleDone: () => void;
}

/**
 * Drops the redesigned Tasks workspace's detail popup (comments, activity
 * log, checklist, attachments) into a non-Tasks-page context — the classic
 * Dashboard's task widget, and the Lead/Deal workspace task tabs — behind
 * crm.tasks-workspace-redesign. Callers own selection state (which task id
 * is open) the same way the old per-site modals did; this only owns turning
 * a raw Task into what TaskDetailModal needs.
 *
 * The caller's `task` must already carry TaskPresenter::present()'s shape
 * (subtasks/files/deals/leads/properties/developer_projects) — the backend
 * side of this integration eager-loads and serializes through that same
 * presenter behind the same flag, so this is safe to assume, not something
 * this component re-fetches or defends against.
 */
export default function TaskRedesignDetailModal({
    task,
    columns,
    permissions,
    currentUser,
    people,
    toggling = false,
    onClose,
    onEdit,
    onToggleDone,
}: TaskRedesignDetailModalProps) {
    const { props } = usePage();
    // Deal/lead `permissions` is a page-specific subset and omits comment
    // scopes. Fill those from auth.permissions (shared on every page) so
    // the composer isn't hidden just because the host page never listed
    // add_task_comments.
    const resolvedPermissions = useMemo<TaskPermissionSet | undefined>(() => {
        const authPermissions = props.auth?.permissions as
            | TaskPermissionSet
            | undefined;
        if (!permissions && !authPermissions) return undefined;
        return { ...(authPermissions ?? {}), ...(permissions ?? {}) };
    }, [permissions, props.auth?.permissions]);

    const completedSlugs = useMemo(
        () =>
            columns
                .filter((column) => column.slug === "done")
                .map((column) => column.slug),
        [columns],
    );

    const vm = useMemo(
        () => (task ? toTaskViewModel(task, completedSlugs) : null),
        [task, completedSlugs],
    );

    const canWrite = task
        ? canEditTask(task, resolvedPermissions, currentUser.id)
        : false;
    const canComment = task
        ? canCommentOnTask(task, resolvedPermissions, currentUser.id)
        : false;

    return (
        <TaskDetailModal
            vm={vm}
            onClose={onClose}
            onEdit={onEdit}
            onToggleDone={onToggleDone}
            canWrite={canWrite}
            canManageChecklist={canWrite}
            canComment={canComment}
            toggling={toggling}
            people={people}
            currentUser={currentUser}
            deleteCommentScope={asCommentDeleteScope(
                resolvedPermissions?.delete_task_comments,
            )}
        />
    );
}
