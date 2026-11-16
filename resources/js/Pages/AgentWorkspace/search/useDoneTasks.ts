import { useCallback, useState } from "react";
import { App } from "antd";
import useTaskStatus from "@/Hooks/useTaskStatus";
import useTranslation from "@/Hooks/useTranslation";

/**
 * Marks a found task done from its row. The row shows it done at once; if the
 * server refuses, the row goes back and says so, as Today does.
 */
export default function useDoneTasks() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [doneIds, setDoneIds] = useState<Set<number>>(() => new Set());

    const { setStatus, isPending } = useTaskStatus(
        () => {},
        (taskId, slug) => {
            if (slug !== "done") return;
            setDoneIds((current) => {
                const next = new Set(current);
                next.delete(taskId);
                return next;
            });
            message.error(t("pages.tasks.feedback.complete_failed"));
        },
    );

    const complete = useCallback(
        (taskId: number) => {
            setDoneIds((current) => new Set(current).add(taskId));
            setStatus(taskId, "done");
        },
        [setStatus],
    );

    return { doneIds, complete, isPending };
}

export type DoneTasks = ReturnType<typeof useDoneTasks>;
