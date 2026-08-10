import { useState } from "react";
import { message } from "antd";
import { router } from "@inertiajs/react";
import axios from "axios";
import { errorFormatter } from "@/lib/api/utils/common";

/**
 * Move a task's due date from a queue row.
 *
 * Posts tasks.reschedule, which touches only due_date — see
 * TaskController@reschedule for why this is not tasks.update.
 */
export default function useDashboardTaskReschedule(onChanged: () => void) {
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
            message.success("Due date moved");
            onChanged();
        } catch (error) {
            const formatted = errorFormatter(error);
            message.error(formatted.message || "Could not move the due date");
        } finally {
            markPending(taskId, false);
        }
    };

    return { reschedule, isPending: (taskId: number) => pendingIds.has(taskId) };
}
