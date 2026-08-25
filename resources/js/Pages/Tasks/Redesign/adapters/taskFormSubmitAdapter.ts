import type { Task } from "@/Types/Task";
import type { TaskFormValues } from "./taskFormValues";

export interface TaskExtrasPersistResult {
    checklistAdded: number;
    filesUploaded: number;
}

type PersistExtras = (
    taskId: number,
    checklist: string[],
    files: File[],
) => Promise<TaskExtrasPersistResult>;

export function patchTaskExtrasCounts(
    task: Task,
    result: TaskExtrasPersistResult,
): Task {
    return {
        ...task,
        subtasks_count: (task.subtasks_count ?? 0) + result.checklistAdded,
        files_count: (task.files_count ?? 0) + result.filesUploaded,
    };
}

export function patchTaskListExtrasCounts(
    tasks: Task[],
    taskId: number,
    result: TaskExtrasPersistResult,
): Task[] {
    return tasks.map((task) =>
        task.id === taskId ? patchTaskExtrasCounts(task, result) : task,
    );
}

/** After createTask succeeds — run caller cleanup, then persist checklist/files. */
export function afterCreateTaskFormSubmit(
    values: TaskFormValues,
    persistExtras: PersistExtras,
    onDone?: (task?: Task) => void,
    onExtrasPersisted?: (task: Task, result: TaskExtrasPersistResult) => void,
) {
    return (task?: Task) => {
        onDone?.(task);
        if (
            !task?.id ||
            (values.checklist.length === 0 && values.files.length === 0)
        ) {
            return;
        }

        void persistExtras(
            task.id,
            values.checklist,
            values.files,
        ).then((result) => onExtrasPersisted?.(task, result));
    };
}

/** After updateTask succeeds — run caller cleanup, then persist checklist/files. */
export function afterUpdateTaskFormSubmit(
    taskId: number,
    values: TaskFormValues,
    persistExtras: PersistExtras,
    onDone?: () => void,
    onExtrasPersisted?: (result: TaskExtrasPersistResult) => void,
) {
    return () => {
        onDone?.();
        if (values.checklist.length === 0 && values.files.length === 0) {
            return;
        }

        void persistExtras(taskId, values.checklist, values.files).then(
            (result) => onExtrasPersisted?.(result),
        );
    };
}
