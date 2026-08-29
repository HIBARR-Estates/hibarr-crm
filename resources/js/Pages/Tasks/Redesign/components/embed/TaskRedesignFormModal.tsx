import { useMemo } from "react";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/Task";
import { toTaskViewModel } from "../../adapters/taskViewModel";
import {
    taskFormInitialFromVm,
    type RecordPool,
    type TaskFormValues,
    type TaskLinkRef,
} from "../../adapters/taskFormValues";
import TaskFormModal from "../TaskFormModal";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UserOption {
    id: number;
    name: string;
}

const EMPTY_RECORD_POOL: RecordPool = {
    deal: [],
    lead: [],
    property: [],
    project: [],
};

interface TaskRedesignFormModalProps {
    open: boolean;
    mode: "create" | "edit";
    /** Required in edit mode — the task being edited. */
    editingTask?: Task | null;
    columns: TaskboardColumn[];
    categories: CategoryOption[];
    users?: UserOption[];
    /** Pre-locks this tab's own record (e.g. the current lead/deal) as an un-removable link — see TaskFormModal's lockedLinks. */
    lockedLinks?: TaskLinkRef[];
    saving: boolean;
    errors: string[];
    onClose: () => void;
    onSubmit: (values: TaskFormValues) => void;
}

/**
 * Drops the redesigned Tasks workspace's Add/Edit Task form into a
 * non-Tasks-page context, behind crm.tasks-workspace-redesign — see
 * TaskRedesignDetailModal's doc comment for the pairing and the shape
 * assumption on `editingTask`. Record-search pools ship empty here: linking
 * to *other* records from an already-scoped tab isn't the point, only the
 * locked link to this tab's own record is.
 */
export default function TaskRedesignFormModal({
    open,
    mode,
    editingTask,
    columns,
    categories,
    users,
    lockedLinks,
    saving,
    errors,
    onClose,
    onSubmit,
}: TaskRedesignFormModalProps) {
    const completedSlugs = useMemo(
        () =>
            columns
                .filter((column) => column.slug === "done")
                .map((column) => column.slug),
        [columns],
    );

    const initial = useMemo<Partial<TaskFormValues> | undefined>(() => {
        if (mode !== "edit" || !editingTask) return undefined;
        const vm = toTaskViewModel(editingTask, completedSlugs);
        return taskFormInitialFromVm(vm);
    }, [mode, editingTask, completedSlugs]);

    return (
        <TaskFormModal
            open={open}
            mode={mode}
            onClose={onClose}
            onSubmit={onSubmit}
            saving={saving}
            errors={errors}
            initial={initial}
            categories={categories}
            users={users}
            columns={columns}
            records={EMPTY_RECORD_POOL}
            lockedLinks={lockedLinks}
        />
    );
}
