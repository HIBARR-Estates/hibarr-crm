import { router } from "@inertiajs/react";
import axios from "axios";
import { App } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";

/**
 * Checklist rows and attachments both need a saved task id, so they're
 * written after the task itself. Failures here are toasted rather than
 * blocking — the task is already saved by then.
 */
export default function useTaskExtras() {
    const { td } = useTd();
    const { message } = App.useApp();

    const persistExtras = async (
        taskId: number,
        checklist: string[],
        files: File[],
    ) => {
        for (const title of checklist) {
            try {
                await axios.post(
                    route("sub-tasks.store"),
                    { task_id: taskId, title },
                    { headers: { Accept: "application/json" } },
                );
            } catch (error) {
                console.error("Failed to add checklist item", title, error);
                message.error(
                    td("Failed to save a checklist item. Please try again."),
                );
            }
        }

        if (files.length > 0) {
            const payload = new FormData();
            payload.append("task_id", String(taskId));
            files.forEach((file) => payload.append("file[]", file));
            try {
                await axios.post(route("task-files.store"), payload, {
                    headers: { Accept: "application/json" },
                });
            } catch (error) {
                console.error("Failed to upload task files", error);
                message.error(
                    td("Failed to upload one or more files. Please try again."),
                );
            }
        }

        if (checklist.length || files.length) {
            router.reload({
                only: ["kanbanTasks", "tableTasks", "stats"],
            });
        }
    };

    return { persistExtras };
}
