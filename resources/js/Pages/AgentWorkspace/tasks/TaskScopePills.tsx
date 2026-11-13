import useTranslation from "@/Hooks/useTranslation";
import type { TaskScope } from "./types";

interface TaskScopePillsProps {
    scope: TaskScope;
    /** Team is only for someone who may see everyone's tasks. */
    canSeeTeam: boolean;
    onScope: (scope: TaskScope) => void;
    /** Filters applied besides the scope, shown on the Filters pill. */
    filterCount: number;
    onFilters: () => void;
}

/**
 * The second row under the dock: My tasks, Assigned by me and Team (the
 * Tasks index's own mine, by-me and all views), and Filters. Changing the
 * scope re-reads the list without leaving the page.
 */
export default function TaskScopePills({ scope, canSeeTeam, onScope, filterCount, onFilters }: TaskScopePillsProps) {
    const { t } = useTranslation();
    const scopes: TaskScope[] = canSeeTeam ? ["mine", "byme", "team"] : ["mine", "byme"];

    return (
        <nav className="agent-pills" aria-label={t("pages.agent_workspace.tasks.scope.label")}>
            {scopes.map((key) => (
                <button key={key} type="button" className="agent-pills__pill" aria-pressed={scope === key} onClick={() => onScope(key)}>
                    {t(`pages.agent_workspace.tasks.scope.${key}`)}
                </button>
            ))}
            <button type="button" className="agent-pills__pill" aria-pressed={filterCount > 0} onClick={onFilters}>
                {filterCount > 0 ? t("pages.agent_workspace.tasks.filters_count", { count: filterCount }) : t("pages.agent_workspace.tasks.filters")}
            </button>
        </nav>
    );
}
