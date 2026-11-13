import type { ReactNode } from "react";
import { Head } from "@inertiajs/react";
import { AgentListSearch, AgentSecondRow, AgentWorkspaceLayout } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import BrowseView from "./portfolio/BrowseView";
import ForDealsView from "./portfolio/ForDealsView";
import PortfolioPills from "./portfolio/PortfolioPills";
import { useBrowseSearch } from "./portfolio/browseVisit";
import ProjectsView from "./portfolio/ProjectsView";
import type { BrowseFilters, BrowseOptions, PortfolioDeal, PortfolioProject, PortfolioView, PropertiesPayload, RecommendationsPayload } from "./portfolio/types";
import "./portfolio/portfolio.css";

interface PortfolioProps {
    pageTitle: string;
    view: PortfolioView;
    deals?: PortfolioDeal[];
    dealId?: number | null;
    recommendations?: RecommendationsPayload;
    filters?: BrowseFilters;
    limit?: number;
    properties?: PropertiesPayload;
    options?: BrowseOptions;
    projects?: PortfolioProject[];
}

/**
 * Portfolio: the three listings views (approved layouts L7-18 to L7-20) on
 * one page component, so switching between them keeps the shell. Data is the
 * Properties, Projects and recommendation features' own.
 */
export default function Portfolio({ pageTitle, view, deals = [], dealId = null, recommendations, filters = {}, limit = 24, properties, options, projects }: PortfolioProps) {
    const { t } = useTranslation();
    const { text, setText } = useBrowseSearch(filters, view === "browse");

    const subtitle =
        view === "deals"
            ? deals.length === 1
                ? t("pages.agent_workspace.portfolio.subtitle_deals_one")
                : t("pages.agent_workspace.portfolio.subtitle_deals", { count: deals.length })
            : view === "browse"
              ? properties
                  ? properties.total === 1
                      ? t("pages.agent_workspace.portfolio.subtitle_browse_one")
                      : t("pages.agent_workspace.portfolio.subtitle_browse", { count: properties.total })
                  : t("pages.agent_workspace.portfolio.subtitle_browse_loading")
              : t("pages.agent_workspace.portfolio.subtitle_projects");

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <PortfolioPills view={view} />
            </AgentSecondRow>

            <div className={`agent-pf${view === "browse" ? " agent-pf--search" : ""}`}>
                <div className="agent-list-head">
                    <div className="agent-pf__top">
                        <div className="agent-pf__heading">
                            <h1>{t("pages.agent_workspace.portfolio.title")}</h1>
                            <p aria-live="polite">{subtitle}</p>
                        </div>
                    </div>
                    {view === "browse" ? (
                        <AgentListSearch value={text} onChange={setText} placeholder={t("pages.agent_workspace.portfolio.browse.search")} />
                    ) : null}
                </div>

                {view === "deals" ? <ForDealsView deals={deals} dealId={dealId} recommendations={recommendations} /> : null}
                {view === "browse" ? <BrowseView filters={filters} limit={limit} properties={properties} options={options} /> : null}
                {view === "projects" ? <ProjectsView projects={projects} /> : null}
            </div>
        </>
    );
}

Portfolio.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
