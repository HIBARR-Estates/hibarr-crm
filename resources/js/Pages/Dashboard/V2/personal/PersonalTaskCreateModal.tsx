import { useCallback } from "react";
import { Deferred, usePage } from "@inertiajs/react";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import {
    formLinksPayload,
    type TaskFormValues,
} from "@/Pages/Tasks/Redesign/adapters/taskFormValues";

interface CategoryOption {
    id: number;
    category_name: string;
}

interface PersonalTaskCreateModalProps {
    open: boolean;
    taskBoardColumns: TaskboardColumn[];
    onClose: () => void;
    /** Fires after a successful create — the caller decides how to refresh. */
    onCreated: () => void;
}

/**
 * "Add task" from the personal dashboard header.
 *
 * The same TaskRedesignFormModal every other embed uses, in create mode with
 * no locked link — this page isn't scoped to one lead or deal, so unlike the
 * Deal/Lead workspace tabs there's nothing to pre-attach. Behind
 * crm.tasks-workspace-redesign only; see PersonalTaskModal's own note on why
 * the older SaveTaskModal fallback isn't wired here — it needs labels/
 * projects/a full user list this page doesn't fetch, for a page whose whole
 * task-modal integration already assumes the flag everywhere else.
 *
 * Not wired into `visibleQueue`'s local overrides — a brand new task is a
 * genuinely new row for the server to place into a bucket, not a patch to an
 * existing one, so `onCreated` re-resolves the deferred queue instead.
 */
export default function PersonalTaskCreateModal({
    open,
    taskBoardColumns,
    onClose,
    onCreated,
}: PersonalTaskCreateModalProps) {
    const { props } = usePage();
    const noopSetTasks = useCallback(() => {}, []);
    const { createTask, isCreating, createErrors, clearCreateErrors } =
        useTasksWorkspaceMutations(noopSetTasks, null);

    return (
        <Deferred data="taskCategories" fallback={null}>
            <TaskRedesignFormModal
                open={open}
                mode="create"
                columns={taskBoardColumns}
                categories={
                    (props.taskCategories as unknown as
                        | CategoryOption[]
                        | undefined) ?? []
                }
                saving={isCreating}
                errors={createErrors}
                onClose={() => {
                    clearCreateErrors();
                    onClose();
                }}
                onSubmit={(values: TaskFormValues) => {
                    createTask(
                        {
                            title: values.title,
                            startDate: values.startDate,
                            dueDate: values.dueDate,
                            dueTime: values.dueTime,
                            priority: values.priority,
                            description: values.description,
                            assignees: values.assignees,
                            categoryId: values.categoryId,
                            boardColumnId: values.boardColumnId ?? undefined,
                            links: formLinksPayload(values),
                        },
                        () => {
                            onClose();
                            onCreated();
                        },
                    );
                }}
            />
        </Deferred>
    );
}
