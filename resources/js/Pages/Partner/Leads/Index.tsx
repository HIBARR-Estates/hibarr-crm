import { useCallback, useMemo, useState } from "react";
import { Deferred, router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import EntityListHeader, { FiltersButton } from "@/Components/Redesign/primitives/EntityListHeader";
import { REDESIGN_FONT_STACK, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import { describeFilters } from "@/Features/Filters/filterSummary";
import createPartnerLeadFilterConfig from "@/configs/partnerLeadFilterConfig";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import LeadDetailModal from "./components/LeadDetailModal";
import PartnerLeadsResultsView from "./components/PartnerLeadsResultsView";
import usePartnerLeadDetail from "./hooks/usePartnerLeadDetail";
import "./partner-leads-redesign.css";
import type { PartnerLeadOptions, PartnerLeadsPage } from "./types";

interface Props {
    pageTitle: string;
    /** Deferred: null for an account with no partner record. */
    leads?: PartnerLeadsPage | null;
    hasAgent: boolean;
}

const NO_OPTIONS: PartnerLeadOptions = { statuses: [] };

/** Placeholder rows shaped like the table, so the page does not jump when it lands. */
function ResultsSkeleton() {
    return (
        <div
            aria-hidden
            style={{ background: T.WHITE, border: `1px solid ${T.BORDER}`, borderRadius: 10, overflow: "hidden" }}
        >
            {Array.from({ length: 6 }).map((_, index) => (
                <div
                    key={index}
                    style={{ height: 64, borderBottom: `1px solid ${T.BORDER_SOFT}`, background: index % 2 ? T.WHITE : T.SURFACE_2, opacity: 0.6 }}
                />
            ))}
        </div>
    );
}

const PartnerLeadsIndex = ({ pageTitle, leads, hasAgent }: Props) => {
    const { td } = useTd();
    const { t } = useTranslation();
    const { detail, loading, error, open, close } = usePartnerLeadDetail();
    // Which lead's modal is open; the detail itself lives in usePartnerLeadDetail.
    const [openId, setOpenId] = useState<number | null>(null);
    const [isPaging, setIsPaging] = useState(false);

    // ── Shared filters ─────────────────────────────────────────────────
    // Same workbench as Leads/Deals/Tasks/Meetings: the config declares the
    // fields, `FilterContext` owns the values and writes them to the query
    // string, and the server reads them back. The options are only what this
    // partner's own leads have, so the config follows the loaded data.
    const options = leads?.options ?? NO_OPTIONS;
    const optionsKey = JSON.stringify(options);
    const filterConfig = useMemo(
        () => createPartnerLeadFilterConfig(options),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [optionsKey],
    );
    const { filter } = usePageSearchAndFilter({ filterConfig });
    const { openDrawer } = filter;

    // Count clauses, not raw keys, so the badge matches the filter sentence.
    const activeFilterCount = useMemo(
        () => describeFilters(filter.config, filter.filters).length,
        [filter.config, filter.filters],
    );

    // Partial visits: only the list comes back, so the page does not
    // re-render from scratch and the scroll position holds.
    const visitList = useCallback((overrides: Record<string, string | number | null>) => {
        router.get(route("partner.leads.index"), mergeQueryParams(overrides), {
            only: ["leads"],
            preserveState: true,
            preserveScroll: true,
            onStart: () => setIsPaging(true),
            onFinish: () => setIsPaging(false),
        });
    }, []);

    const show = (id: number) => {
        setOpenId(id);
        open(id);
    };

    const hide = () => {
        setOpenId(null);
        close();
    };

    const title = td("Referred leads");

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[{ name: title }]}
            mainContentClassName="p-0"
            searchComp={
                hasAgent ? (
                    <UniversalSearchBox placeholder={td("Search by name...")} className="w-full" />
                ) : undefined
            }
        >
            <EntityListHeader
                title={title}
                subtitle={td("The leads you have referred, with their status and open, won and lost deals.")}
                sticky
                // On the title line rather than a toolbar row of its own: the
                // page has no tabs or toolbar content for that row to hold.
                actions={
                    hasAgent ? (
                        <FiltersButton
                            count={activeFilterCount}
                            onClick={openDrawer}
                            label={t("app.filter")}
                        />
                    ) : undefined
                }
                // Only when something actually narrows the list: the header
                // renders the band around whatever it is given, so passing an
                // element that renders nothing would leave an empty grey strip.
                filterSentence={
                    activeFilterCount > 0 ? (
                        <ActiveFilterSentence
                            count={leads?.total}
                            entityLabel="leads"
                            onOpenFilters={openDrawer}
                        />
                    ) : undefined
                }
            />

            <div className="mx-auto w-full max-w-screen-2xl px-6 py-6" style={{ fontFamily: REDESIGN_FONT_STACK }}>
                {!hasAgent ? (
                    <EmptyState
                        icon="users"
                        title={td("No partner record")}
                        description={td("This account is not set up as a partner yet.")}
                    />
                ) : (
                    <Deferred data="leads" fallback={<ResultsSkeleton />}>
                        {leads ? (
                            <PartnerLeadsResultsView
                                leads={leads}
                                onOpen={show}
                                onPageChange={(page) => visitList({ page })}
                                onPageSizeChange={(size) => visitList({ per_page: size, page: null })}
                                isPaging={isPaging}
                                filtered={activeFilterCount > 0}
                                onClearFilters={filter.resetFilters}
                            />
                        ) : (
                            <EmptyState
                                icon="users"
                                title={td("No referrals yet")}
                                description={td("Leads you refer will appear here.")}
                            />
                        )}
                    </Deferred>
                )}
            </div>

            <LeadDetailModal open={openId !== null} detail={detail} loading={loading} error={error} onClose={hide} />

            <EntityFilterModal
                config={filterConfig}
                optionsLoading={!leads}
                entityLabel="leads"
                currentCount={leads?.total}
                savedViews={false}
            />
        </PageLayout>
    );
};

PartnerLeadsIndex.layout = (page: React.ReactNode) => <DashboardLayout>{page}</DashboardLayout>;

export default PartnerLeadsIndex;
