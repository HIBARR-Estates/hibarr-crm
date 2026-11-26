import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { Deferred } from "@inertiajs/react";
import { AgentPager } from "@/Components/Redesign/agent";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import PropertyCard from "./PropertyCard";
import { visitList } from "./portfolioVisit";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { BrowseFilters, BrowseOptions, PortfolioProperty, PropertiesPayload } from "./types";

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

interface BrowseViewProps {
    filters: BrowseFilters;
    properties?: PropertiesPayload;
    options?: BrowseOptions;
}

function GridSkeleton() {
    return (
        <ul className="agent-pf__grid agent-pf__grid--browse" aria-busy="true">
            {Array.from({ length: 8 }).map((_, index) => (
                <li key={index} className="agent-pf__card">
                    <div className="dr-skeleton" style={{ height: 118, borderRadius: 12 }} />
                    <div className="dr-skeleton" style={{ height: 14, width: "70%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 12, width: "90%", borderRadius: 6 }} />
                </li>
            ))}
        </ul>
    );
}

/**
 * Browse (L7-19): every property the agent may see, newest first, sixteen to
 * a page in four columns. Search, the Filters pill in the second row and the
 * pager are partial visits that keep the page; the cards follow the shell.
 */
export default function BrowseView({ filters, properties, options }: BrowseViewProps) {
    const { t } = useTranslation();
    const [expose, setExpose] = useState<ExposeTarget | null>(null);

    const statusLabels = useMemo(() => new Map((options?.construction_statuses ?? []).map((item) => [item.name, item.label])), [options]);

    const openExpose = useCallback(
        (property: PortfolioProperty) => setExpose({ kind: "property", id: property.id, title: property.title, subtitle: property.project ?? undefined }),
        [],
    );

    const goTo = useCallback((page: number) => visitList("agent.portfolio.browse", filters, page), [filters]);

    const anyFilter = Object.values(filters).some(Boolean);

    return (
        <div className="agent-pf__browse">
            <Deferred data="properties" fallback={<GridSkeleton />}>
                {properties && properties.items.length > 0 ? (
                    <>
                        <ul className="agent-pf__grid agent-pf__grid--browse">
                            {properties.items.map((property) => (
                                <PropertyCard key={property.id} property={property} statusLabel={statusLabels.get(property.construction_status ?? "")} onExpose={openExpose} />
                            ))}
                        </ul>
                        <AgentPager
                            page={properties.page}
                            lastPage={properties.last_page}
                            from={properties.from}
                            to={properties.to}
                            total={properties.total}
                            onPage={goTo}
                            label={t("pages.agent_workspace.portfolio.browse.pages")}
                        />
                    </>
                ) : (
                    <section className="agent-pf__panel">
                        <EmptyState
                            icon="building"
                            title={t("pages.agent_workspace.portfolio.browse.empty_title")}
                            description={t(anyFilter ? "pages.agent_workspace.portfolio.browse.empty_filtered" : "pages.agent_workspace.portfolio.browse.empty_description")}
                        />
                    </section>
                )}
            </Deferred>

            {expose ? (
                <Suspense fallback={null}>
                    <PortfolioExposeModal target={expose} onClose={() => setExpose(null)} />
                </Suspense>
            ) : null}
        </div>
    );
}
