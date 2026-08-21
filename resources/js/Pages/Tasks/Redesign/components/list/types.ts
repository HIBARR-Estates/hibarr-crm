import type { TaskViewModel } from "../../adapters/taskViewModel";

export interface TaskGroup {
    key: string;
    label: string;
    dot: string;
    fg: string;
    tasks: TaskViewModel[];
    /**
     * The group's size across the whole result set. Set when a group is split
     * across pages, so the header shows the true total rather than the number
     * of rows on this page.
     */
    totalCount?: number;
}
