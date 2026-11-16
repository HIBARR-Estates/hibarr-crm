import { Suspense, lazy, useCallback, useRef, useState, type ReactNode } from "react";
import { Head, usePage } from "@inertiajs/react";
import { AgentListSearch, AgentSecondRow, AgentWorkspaceLayout } from "@/Components/Redesign/agent";
import { useFilter } from "@/contexts/FilterContext";
import useTranslation from "@/Hooks/useTranslation";
import BrowseView from "./portfolio/BrowseView";
import ForDealsView from "./portfolio/ForDealsView";
import PortfolioPills from "./portfolio/PortfolioPills";
import { filterCount, useListSearchVisit } from "./portfolio/portfolioVisit";
import ProjectsView from "./portfolio/ProjectsView";
import type {
    BrowseFilters,
    BrowseOptions,
    DealsPageMeta,
    PortfolioDeal,
    PortfolioPipeline,
    PortfolioView,
    ProjectFilters,
    ProjectOptions,
    ProjectsPayload,
    PropertiesPayload,
    RecommendationsPayload,
} from "./portfolio/types";
import "./portfolio/portfolio.css";

// The shared filter modal with this page's fields: loaded the first time
// Filters is pressed.
const PortfolioFilterModal = lazy(() => import("./portfolio/PortfolioFilterModal"));

interface PortfolioProps {
    pageTitle: string;
    view: PortfolioView;
    pipelines?: PortfolioPipeline[];
    pipelineId?: string;
    deals?: PortfolioDeal[];
    dealsPage?: DealsPageMeta;
    selectedDeal?: PortfolioDeal | null;
    recommendations?: RecommendationsPayload;
    filters?: BrowseFilters | ProjectFilters;
    properties?: PropertiesPayload;
    projects?: ProjectsPayload;
    options?: BrowseOptions | ProjectOptions;
}

const EMPTY_PAGE: DealsPageMeta = { page: 1, last_page: 1, per_page: 8, from: 0, to: 0, total: 0 };

/**
 * Portfolio: the three listings views (approved layouts L7-18 to L7-20) on
 * one page component, so switching between them keeps the shell. Data is the
 * Properties, Projects and recommendation features' own. Every list is paged
 * and Browse and Projects share the workspace's search and Filters pill.
 */
export default function Portfolio({
    pageTitle,
    view,
    pipelines = [],
    pipelineId = "all",
    deals = [],
    dealsPage = EMPTY_PAGE,
    selectedDeal = null,
    recommendations,
    filters = {},
    properties,
    projects,
    options,
}: PortfolioProps) {
    const { t } = useTranslation();
    const { url } = usePage();
    const { openDrawer } = useFilter();
    const listing = view === "browse" || view === "projects";
    const routeName = view === "projects" ? "agent.portfolio.projects" : "agent.portfolio.browse";
    const { text, setText } = useListSearchVisit(routeName, filters, listing);

    // The modal mounts on first use and opens itself; later presses just open it.
    const [filtersMounted, setFiltersMounted] = useState(false);
    const mountedRef = useRef(false);
    const openFilters = useCallback(() => {
        if (mountedRef.current) {
            openDrawer();
            return;
        }
        mountedRef.current = true;
        setFiltersMounted(true);
    }, [openDrawer]);

    const loaded = view === "projects" ? projects : properties;
    const subtitle =
        view === "deals"
            ? dealsPage.total === 1
                ? t("pages.agent_workspace.portfolio.subtitle_deals_one")
                : t("pages.agent_workspace.portfolio.subtitle_deals", { count: dealsPage.total })
            : view === "browse"
              ? properties
                  ? properties.total === 1
                      ? t("pages.agent_workspace.portfolio.subtitle_browse_one")
                      : t("pages.agent_workspace.portfolio.subtitle_browse", { count: properties.total })
                  : t("pages.agent_workspace.portfolio.subtitle_browse_loading")
              : projects
                ? projects.total === 1
                    ? t("pages.agent_workspace.portfolio.subtitle_projects_one")
                    : t("pages.agent_workspace.portfolio.subtitle_projects_count", { count: projects.total })
                : t("pages.agent_workspace.portfolio.subtitle_projects");

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <PortfolioPills view={view} filterCount={listing ? filterCount(filters) : 0} onFilters={listing ? openFilters : undefined} />
            </AgentSecondRow>

            <div className={`agent-pf${listing ? " agent-pf--search" : ""}`}>
                <div className="agent-list-head">
                    <div className="agent-pf__top">
                        <div className="agent-pf__heading">
                            <h1>{t("pages.agent_workspace.portfolio.title")}</h1>
                            <p aria-live="polite">{subtitle}</p>
                            {listing ? (
                                <AgentListSearch
                                    value={text}
                                    onChange={setText}
                                    placeholder={t(view === "projects" ? "pages.agent_workspace.portfolio.projects.search" : "pages.agent_workspace.portfolio.browse.search")}
                                />
                            ) : null}
                        </div>
                    </div>
                </div>

                {view === "deals" ? (
                    <ForDealsView
                        deals={deals}
                        dealsPage={dealsPage}
                        selectedDeal={selectedDeal}
                        pipelines={pipelines}
                        pipelineId={pipelineId}
                        recommendations={recommendations}
                    />
                ) : null}
                {view === "browse" ? <BrowseView filters={filters as BrowseFilters} properties={properties} options={options as BrowseOptions | undefined} /> : null}
                {view === "projects" ? <ProjectsView filters={filters as ProjectFilters} projects={projects} /> : null}
            </div>

            {listing && filtersMounted ? (
                <Suspense fallback={null}>
                    <PortfolioFilterModal
                        view={view as "browse" | "projects"}
                        options={options}
                        total={loaded?.total ?? 0}
                        appliedKey={`${url}|${JSON.stringify(filters)}`}
                    />
                </Suspense>
            ) : null}
        </>
    );
}

Portfolio.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
