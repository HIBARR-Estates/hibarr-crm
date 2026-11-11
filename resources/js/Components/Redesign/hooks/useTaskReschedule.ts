import { useState } from "react";
import { message } from "antd";
import axios from "axios";
import { errorFormatter } from "@/lib/api/utils/common";
import useTranslation from "@/Hooks/useTranslation";

/**
 * Move a task's due date from a queue row (personal dashboard, agent Today).
 *
 * Posts tasks.reschedule, which touches only due_date — see
 * TaskController@reschedule for why this is not tasks.update.
 *
 * `onError` is optional — a caller that already patched the task's due date
 * optimistically (see the personal dashboard's queue) needs it to roll that
 * back; a caller happy to wait for the request can leave it out.
 */
export default function useTaskReschedule(
    onChanged: () => void,
    onError?: (taskId: number) => void,
) {
    const { t } = useTranslation();
    const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());

    const markPending = (taskId: number, pending: boolean) => {
        setPendingIds((prev) => {
            const next = new Set(prev);
            if (pending) next.add(taskId);
            else next.delete(taskId);
            return next;
        });
    };

    const reschedule = async (taskId: number, dueDate: string) => {
        markPending(taskId, true);

        try {
            await axios.post(route("tasks.reschedule", taskId), {
                due_date: dueDate,
            });
            message.success(t("pages.tasks.feedback.due_moved"));
            onChanged();
        } catch (error) {
            const formatted = errorFormatter(error);
            message.error(formatted.message || t("pages.tasks.feedback.due_move_failed"));
            onError?.(taskId);
        } finally {
            markPending(taskId, false);
        }
    };

    return { reschedule, isPending: (taskId: number) => pendingIds.has(taskId) };
}
