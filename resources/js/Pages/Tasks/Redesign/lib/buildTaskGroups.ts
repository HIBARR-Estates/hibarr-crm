import type { TaskGroup } from "../components/TasksListView";
import type { GroupMode } from "../components/TasksFilterBar";
import type { TaskViewModel } from "../adapters/taskViewModel";
import {
    TASK_BUCKETS,
    UNCATEGORISED_LABEL,
    categoryToken,
} from "../config/taskDesignTokens";

/** Groups the tasks on the current server page (client-side layout only). */
export default function buildTaskGroups(
    viewModels: TaskViewModel[],
    groupMode: GroupMode,
): TaskGroup[] {
    if (viewModels.length === 0) {
        return [];
    }

    if (groupMode === "due") {
        return TASK_BUCKETS.map((bucket) => ({
            key: bucket.key,
            label: bucket.label,
            dot: bucket.dot,
            fg: bucket.fg,
            tasks: viewModels.filter((vm) => vm.bucket === bucket.key),
        })).filter((group) => group.tasks.length > 0);
    }

    if (groupMode === "category") {
        const byCategory = new Map<string, TaskGroup>();
        viewModels.forEach((vm) => {
            const name = vm.task.category?.category_name ?? UNCATEGORISED_LABEL;
            const token = categoryToken(name)!;
            if (!byCategory.has(name)) {
                byCategory.set(name, {
                    key: `category-${name}`,
                    label: token.label,
                    dot: token.dot,
                    fg: token.fg,
                    tasks: [],
                });
            }
            byCategory.get(name)!.tasks.push(vm);
        });
        return Array.from(byCategory.values()).sort((a, b) => {
            // Uncategorised always sorts last, regardless of size.
            if (a.label === UNCATEGORISED_LABEL) return 1;
            if (b.label === UNCATEGORISED_LABEL) return -1;
            return b.tasks.length - a.tasks.length;
        });
    }

    return [
        {
            key: "all",
            label: "All tasks",
            dot: "#9ca3af",
            fg: "#5b6472",
            tasks: viewModels,
        },
    ];
}
