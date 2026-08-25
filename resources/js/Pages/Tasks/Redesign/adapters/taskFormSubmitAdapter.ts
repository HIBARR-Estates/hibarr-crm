import type { Task } from "@/Types/Task";
import type { TaskFormValues } from "./taskFormValues";

type PersistExtras = (
    taskId: number,
    checklist: string[],
    files: File[],
) => Promise<void>;

/** After createTask succeeds — run caller cleanup, then persist checklist/files. */
export function afterCreateTaskFormSubmit(
    values: TaskFormValues,
    persistExtras: PersistExtras,
    onDone?: (task?: Task) => void,
) {
    return (task?: Task) => {
        onDone?.(task);
        if (task?.id) {
            void persistExtras(task.id, values.checklist, values.files);
        }
    };
}

/** After updateTask succeeds — run caller cleanup, then persist checklist/files. */
export function afterUpdateTaskFormSubmit(
    taskId: number,
    values: TaskFormValues,
    persistExtras: PersistExtras,
    onDone?: () => void,
) {
    return () => {
        onDone?.();
        void persistExtras(taskId, values.checklist, values.files);
    };
}
