import { useCallback } from "react";
import { formLinksPayload, type TaskFormValues } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterCreateTaskFormSubmit, type TaskExtrasPersistResult } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import type { Task } from "@/Types/Task";

interface Options {
    /** Called with the saved task, before its checklist and files are written. */
    onCreated: (task: Task | undefined) => void;
    /** Called once the checklist rows and files are saved, to patch their counts. */
    onExtras?: (task: Task, result: TaskExtrasPersistResult) => void;
    /** Who gets the task when the agent clears every assignee (the deal's agent). */
    fallbackAssignee?: number | null;
    sourceEmailMessageId?: string | null;
}

/**
 * Saves the agent task form through the Tasks workspace's endpoints: the task
 * with its links, category and status, then its checklist rows and files.
 * The caller patches its own list from `onCreated`; nothing reloads.
 */
export default function useAgentTaskCreate({ onCreated, onExtras, fallbackAssignee = null, sourceEmailMessageId = null }: Options) {
    const { persistExtras } = useTaskExtras();
    const { createTask, isCreating, createErrors, clearCreateErrors } = useTasksWorkspaceMutations(() => {}, null);

    const submit = useCallback(
        (values: TaskFormValues) =>
            createTask(
                {
                    title: values.title,
                    startDate: values.startDate,
                    dueDate: values.dueDate,
                    dueTime: values.dueTime,
                    priority: values.priority,
                    description: values.description,
                    assignees: values.assignees.length ? values.assignees : fallbackAssignee ? [fallbackAssignee] : [],
                    categoryId: values.categoryId,
                    boardColumnId: values.boardColumnId ?? undefined,
                    links: formLinksPayload(values),
                    sourceEmailMessageId,
                },
                afterCreateTaskFormSubmit(values, persistExtras, onCreated, onExtras),
            ),
        [createTask, fallbackAssignee, onCreated, onExtras, persistExtras, sourceEmailMessageId],
    );

    return { submit, saving: isCreating, errors: createErrors, clearErrors: clearCreateErrors };
}
