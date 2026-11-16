import { useEffect, useMemo } from "react";
import createTaskFilterConfig from "@/configs/taskFilterConfig";
import { useFilter } from "@/contexts/FilterContext";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";

interface TasksFilterModalProps {
    categories?: Array<{ id: number; category_name: string }>;
    labels?: Array<{ id: number; label_name: string; label_color?: string }>;
    users?: Array<{ id: number; name: string }>;
    projects?: Array<{ id: number; project_name: string }>;
    total: number;
    /** Changes whenever the applied filters do, so the modal re-reads the URL. */
    appliedKey: string;
}

/**
 * The Tasks index's own filter modal, pointed at this page: same fields and
 * query-string contract, applying is a visit of /agent/tasks (the scope stays
 * in the URL). Loaded the first time Filters is pressed.
 */
export default function TasksFilterModal({ categories, labels, users, projects, total, appliedKey }: TasksFilterModalProps) {
    const { openDrawer } = useFilter();

    const filterConfig = useMemo(
        () => ({
            ...createTaskFilterConfig({
                categories,
                labels,
                users,
                projects,
                // The page is the open tasks, and the search is not part of this design.
                excludeFields: ["status", "search"],
            } as never),
            routeName: "agent.tasks",
            only: undefined,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [categories, labels, users, projects, appliedKey],
    );

    usePageSearchAndFilter({ filterConfig });

    // Pressing Filters is what mounts this, so it opens as soon as it exists.
    useEffect(() => {
        const handle = window.setTimeout(openDrawer, 0);
        return () => window.clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <EntityFilterModal config={filterConfig} optionsLoading={!users} entityLabel="tasks" currentCount={total} savedViews={false} />;
}
