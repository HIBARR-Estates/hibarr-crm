import type { TaskFormValues } from "../components/TaskFormModal";

/**
 * Module-level UI state for the tasks workspace. Survives Inertia partial
 * reloads (including deferred prop resolution) so an open create/edit modal
 * and in-progress form drafts are not lost mid-entry.
 */
interface TasksWorkspaceUiStore {
    addOpen: boolean;
    editingTaskId: number | null;
    duplicatingTaskId: number | null;
    formDrafts: Record<string, TaskFormValues>;
}

const store: TasksWorkspaceUiStore = {
    addOpen: false,
    editingTaskId: null,
    duplicatingTaskId: null,
    formDrafts: {},
};

export function readTasksWorkspaceUi(): Readonly<TasksWorkspaceUiStore> {
    return store;
}

export function patchTasksWorkspaceUi(
    patch: Partial<
        Pick<
            TasksWorkspaceUiStore,
            "addOpen" | "editingTaskId" | "duplicatingTaskId"
        >
    >,
): void {
    Object.assign(store, patch);
}

export function readTaskFormDraft(key: string): TaskFormValues | undefined {
    return store.formDrafts[key];
}

export function writeTaskFormDraft(
    key: string,
    draft: TaskFormValues | null,
): void {
    if (draft === null) {
        delete store.formDrafts[key];
        return;
    }
    store.formDrafts[key] = draft;
}

export const TASK_FORM_DRAFT_KEYS = {
    create: "create",
    duplicate: "duplicate",
    edit: (taskId: number) => `edit:${taskId}`,
} as const;
