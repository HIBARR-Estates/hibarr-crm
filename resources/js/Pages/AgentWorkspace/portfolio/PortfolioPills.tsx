import { AgentLinkPills, type AgentLinkPill } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { PortfolioView } from "./types";

const VIEWS: Array<{ key: PortfolioView; href: string }> = [
    { key: "deals", href: "/agent/portfolio" },
    { key: "browse", href: "/agent/portfolio/browse" },
    { key: "projects", href: "/agent/portfolio/projects" },
];

interface PortfolioPillsProps {
    view: PortfolioView;
    /** Filters applied on Browse or Projects, shown on the Filters pill. */
    filterCount: number;
    /** Opens the filter modal; only Browse and Projects have one. */
    onFilters?: () => void;
}

/**
 * The second row: For my deals, Browse, Projects (each its own page, so links)
 * and, on the two listings, the Filters pill every list page in the workspace
 * carries.
 */
export default function PortfolioPills({ view, filterCount, onFilters }: PortfolioPillsProps) {
    const { t } = useTranslation();
    const pills: AgentLinkPill[] = VIEWS.map(({ key, href }) => ({
        key,
        href,
        label: t(`pages.agent_workspace.portfolio.pills.${key}`),
        current: key === view,
    }));

    return (
        <AgentLinkPills
            pills={pills}
            ariaLabel={t("pages.agent_workspace.portfolio.pills.label")}
            trailing={
                onFilters ? (
                    <button type="button" className="agent-pills__pill" aria-pressed={filterCount > 0} onClick={onFilters}>
                        {filterCount > 0 ? t("pages.agent_workspace.portfolio.filters_count", { count: filterCount }) : t("app.filter")}
                    </button>
                ) : null
            }
        />
    );
}
