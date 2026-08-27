import axios from "axios";
import { App } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TaskExtrasPersistResult } from "../adapters/taskFormSubmitAdapter";

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
    ): Promise<TaskExtrasPersistResult> => {
        let checklistAdded = 0;
        const failedTitles: string[] = [];
        for (const title of checklist) {
            try {
                await axios.post(
                    route("sub-tasks.store"),
                    { task_id: taskId, title },
                    { headers: { Accept: "application/json" } },
                );
                checklistAdded += 1;
            } catch (error) {
                console.error("Failed to add checklist item", title, error);
                failedTitles.push(title);
            }
        }
        if (failedTitles.length > 0) {
            message.error(
                td("Failed to save a checklist item. Please try again."),
            );
        }

        let filesUploaded = 0;
        if (files.length > 0) {
            const payload = new FormData();
            payload.append("task_id", String(taskId));
            files.forEach((file) => payload.append("file[]", file));
            try {
                await axios.post(route("task-files.store"), payload, {
                    headers: { Accept: "application/json" },
                });
                filesUploaded = files.length;
            } catch (error) {
                console.error("Failed to upload task files", error);
                message.error(
                    td("Failed to upload one or more files. Please try again."),
                );
            }
        }

        return { checklistAdded, filesUploaded };
    };

    return { persistExtras };
}
