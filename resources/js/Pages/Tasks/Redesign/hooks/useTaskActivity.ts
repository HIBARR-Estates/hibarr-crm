import { useEffect, useState } from "react";
import axios from "axios";

export interface TaskActivityRecord {
    id: number;
    /** TaskHistory.details value, e.g. "statusActivity" — see taskActivityText() for the sentence it maps to. */
    type: string;
    created_at: string | null;
    created_at_human: string | null;
    user: { id: number; name: string; image?: string | null } | null;
    board_column: { column_name: string; label_color: string } | null;
    sub_task: { title: string } | null;
}

/**
 * Loads a task's activity log (status/assignee changes, checklist add,
 * file uploads, ...) once per task open. Unlike comments this isn't
 * paginated — a task's history is realistically small, and it's merged by
 * timestamp into the comments panel rather than scrolled independently.
 */
export default function useTaskActivity(taskId: number | null) {
    const [entries, setEntries] = useState<TaskActivityRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (taskId === null) {
            setEntries([]);
            return;
        }

        let cancelled = false;
        setLoading(true);

        axios
            .get(route("tasks.activity.index", taskId))
            .then((response) => {
                if (cancelled) return;
                setEntries(response.data?.data?.activity ?? []);
            })
            .catch(() => {
                if (!cancelled) setEntries([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [taskId]);

    return { entries, loading };
}
