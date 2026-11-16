import useTranslation from "@/Hooks/useTranslation";
import type { LeadSavedView } from "@/Features/Filters/useLeadSavedViews";

interface PeopleViewPillsProps {
    scope: "all" | "mine";
    /** Saved views the viewer may open; undefined while they load or when saved views are off. */
    views: LeadSavedView[] | undefined;
    /** The view whose filters are applied now: "default", a saved view's id, or null for neither. */
    activeKey: "default" | number | null;
    /** Filters applied besides the chip and search, shown on the Filters pill. */
    filterCount: number;
    onDefault: () => void;
    onView: (view: LeadSavedView) => void;
    onFilters: () => void;
    /** The filter modal is where views are saved, so it is also the way to a new one. */
    canSaveViews: boolean;
}

/**
 * The second row under the dock: the default view (My leads, or All leads for
 * someone who sees everyone), the viewer's saved views, Filters and a new
 * view. Views are the Leads list's own saved filter views, nothing new.
 */
export default function PeopleViewPills({ scope, views, activeKey, filterCount, onDefault, onView, onFilters, canSaveViews }: PeopleViewPillsProps) {
    const { t } = useTranslation();

    return (
        <nav className="agent-pills" aria-label={t("pages.agent_workspace.people.views.label")}>
            <button type="button" className="agent-pills__pill" aria-pressed={activeKey === "default"} onClick={onDefault}>
                {t(scope === "all" ? "pages.agent_workspace.people.views.all" : "pages.agent_workspace.people.views.mine")}
            </button>
            {(views ?? []).map((view) => (
                <button key={view.id} type="button" className="agent-pills__pill" aria-pressed={activeKey === view.id} onClick={() => onView(view)}>
                    {view.name}
                </button>
            ))}
            <button type="button" className="agent-pills__pill" aria-pressed={filterCount > 0 && activeKey === null} onClick={onFilters}>
                {filterCount > 0
                    ? t("pages.agent_workspace.people.views.filters_count", { count: filterCount })
                    : t("pages.agent_workspace.people.views.filters")}
            </button>
            {canSaveViews ? (
                <button type="button" className="agent-pills__pill agent-pills__pill--action" onClick={onFilters}>
                    {t("pages.agent_workspace.people.views.new_view")}
                </button>
            ) : null}
        </nav>
    );
}
