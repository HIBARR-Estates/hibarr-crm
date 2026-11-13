import { Suspense, lazy, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Head, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentSecondRow, AgentWorkspaceLayout, useMinuteClock } from "@/Components/Redesign/agent";
import { useFilter } from "@/contexts/FilterContext";
import type { LeadSavedView } from "@/Features/Filters/useLeadSavedViews";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import PeopleHeader from "./people/PeopleHeader";
import PeopleTable from "./people/PeopleTable";
import PeopleViewPills from "./people/PeopleViewPills";
import { viewSignature } from "./people/format";
import type { LifecycleStatus, PeopleBucket, PeopleCounts, PeopleFilters, PeoplePage, RowExtrasMap } from "./people/types";
import usePeopleList, { queryOf, useListSearch } from "./people/usePeopleList";
import "./people/people.css";

// The Leads list's own filter modal: its code and form data load the first
// time Filters (or New view) is pressed.
const PeopleFilterModal = lazy(() => import("./people/PeopleFilterModal"));

const BUCKETS: PeopleBucket[] = ["overdue", "today", "week", "none"];

interface PeopleProps {
    pageTitle: string;
    userId: number;
    /** "all" for someone who sees every lead, "mine" for anyone narrower. */
    scope: "all" | "mine";
    filters: PeopleFilters;
    leads: PeoplePage;
    leadLifecycleStatuses: LifecycleStatus[];
    counts?: PeopleCounts;
    rowExtras?: RowExtrasMap;
    savedViews?: LeadSavedView[];
    preferredContactTimes?: Array<{ value: string; label: string }>;
}

function first(value: string | string[] | undefined): string {
    return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** A saved view's filters as query-string values (multi-select values are comma-joined on the wire). */
function viewParams(filters: Record<string, unknown>): Record<string, string> {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters ?? {})) {
        if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
        params[key] = Array.isArray(value) ? value.join(",") : String(value);
    }
    return params;
}

/**
 * People: the agent workspace's lead list (approved layout L7-14). Runs on
 * the Leads list's own query, permission scope, filters and saved views.
 * Chips, search, sorting and paging are partial visits that keep the page
 * where it is; the rows come first and the counts, deals and last touch
 * follow.
 */
export default function People({
    pageTitle,
    userId,
    scope,
    filters,
    leads,
    leadLifecycleStatuses,
    counts,
    rowExtras,
    savedViews,
    preferredContactTimes,
}: PeopleProps) {
    const { timezone } = useUserDateTime();
    const nowMs = useMinuteClock();
    const { props, url } = usePage<PageProps>();
    const filterV2 = props.featureFlags?.["crm.leads-filter-v2"] === true;
    const { openDrawer } = useFilter();
    const { visit, busy } = usePeopleList(url);

    const rawBucket = first(filters.next_action);
    const bucket = (BUCKETS as string[]).includes(rawBucket) ? (rawBucket as PeopleBucket) : null;

    // Straight from the applied query, so a view that sets its own sort is reflected.
    const sortDirection: "asc" | "desc" = queryOf(url).sort_direction === "desc" ? "desc" : "asc";
    const toggleSort = useCallback(() => {
        visit({ sort_by: "next_action", sort_direction: sortDirection === "asc" ? "desc" : "asc" });
    }, [sortDirection, visit]);

    const onSearch = useCallback((query: string) => visit({ search: query }), [visit]);
    const { text, setText } = useListSearch(first(filters.search), onSearch);

    // Which view the applied filters amount to: the default (none), a saved view, or neither.
    const signature = useMemo(() => viewSignature(filters), [filters]);
    const filterCount = signature.length;
    const activeKey = useMemo<"default" | number | null>(() => {
        if (filterCount === 0) return "default";
        const match = (savedViews ?? []).find((view) => {
            const wanted = viewSignature(view.filters);
            return wanted.length === signature.length && wanted.every((entry, index) => entry === signature[index]);
        });
        return match ? match.id : null;
    }, [filterCount, savedViews, signature]);

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

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <PeopleViewPills
                    scope={scope}
                    views={savedViews}
                    activeKey={activeKey}
                    filterCount={filterCount}
                    canSaveViews={filterV2}
                    onDefault={() => visit({}, { replaceAll: true })}
                    onView={(view) => visit(viewParams(view.filters), { replaceAll: true })}
                    onFilters={openFilters}
                />
            </AgentSecondRow>

            <div className="agent-pp">
                <PeopleHeader
                    total={leads.total}
                    bucket={bucket}
                    counts={counts}
                    onBucket={(next) => visit({ next_action: next })}
                    searchText={text}
                    onSearchText={setText}
                />
                <PeopleTable
                    page={leads}
                    statuses={leadLifecycleStatuses}
                    extras={rowExtras}
                    userId={userId}
                    nowMs={nowMs}
                    timeZone={timezone}
                    busy={busy}
                    sortDirection={sortDirection}
                    onToggleSort={toggleSort}
                    onPage={(page) => visit({ page })}
                />
            </div>

            {filtersMounted ? (
                <Suspense fallback={null}>
                    <PeopleFilterModal
                        leadLifecycleStatuses={leadLifecycleStatuses}
                        preferredContactTimes={preferredContactTimes}
                        filterV2={filterV2}
                        savedViewsReady={savedViews !== undefined}
                        appliedKey={JSON.stringify(filters)}
                    />
                </Suspense>
            ) : null}
        </>
    );
}

People.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
