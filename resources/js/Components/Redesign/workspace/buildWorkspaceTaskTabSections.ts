import { isCompletedColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { Task } from "@/Types/api/tasks";
export type WorkspaceTaskTabFilter = "open" | "done" | "all";

export interface WorkspaceTaskTabSection<T extends { id: number }> {
    key: string;
    title: string;
    tasks: T[];
}

function taskStatusSlug(task: Task): string {
    return (
        (task as Task & { board_column?: { slug?: string } }).board_column
            ?.slug ||
        task.status ||
        "to_do"
    );
}

function isTaskDone(task: Task, columns: TaskboardColumn[]): boolean {
    const status = taskStatusSlug(task);
    return (
        isCompletedColumn(status, columns) || Boolean(task.completed_on)
    );
}

/** Groups the filtered task list for section headers (mirrors Meetings Live/Upcoming/Past). */
export function buildWorkspaceTaskTabSections<T extends { id: number }>(
    filter: WorkspaceTaskTabFilter,
    filteredTasks: T[],
    rawTasks: Task[],
    columns: TaskboardColumn[],
    sectionTitles: { open: string; done: string },
): WorkspaceTaskTabSection<T>[] {
    if (filter === "open") {
        return filteredTasks.length
            ? [{ key: "open", title: sectionTitles.open, tasks: filteredTasks }]
            : [];
    }
    if (filter === "done") {
        return filteredTasks.length
            ? [{ key: "done", title: sectionTitles.done, tasks: filteredTasks }]
            : [];
    }

    const open: T[] = [];
    const done: T[] = [];
    filteredTasks.forEach((item) => {
        const raw = rawTasks.find((task) => task.id === item.id);
        if (raw && isTaskDone(raw, columns)) {
            done.push(item);
        } else {
            open.push(item);
        }
    });

    const sections: WorkspaceTaskTabSection<T>[] = [];
    if (open.length) {
        sections.push({ key: "open", title: sectionTitles.open, tasks: open });
    }
    if (done.length) {
        sections.push({ key: "done", title: sectionTitles.done, tasks: done });
    }
    return sections;
}
