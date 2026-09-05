import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { REDESIGN_FONT_STACK } from "@/Components/Redesign/tokens";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { describeFilters } from "@/Features/Filters/filterSummary";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import createMeetingFilterConfig from "@/configs/meetingFilterConfig";
import useRowSelection from "@/Hooks/useRowSelection";
import MeetingsHeader from "./components/MeetingsHeader";
import MeetingsBulkBar from "./components/MeetingsBulkBar";
import MeetingsEditDialog from "./components/MeetingsEditDialog";
import MeetingsReportDialog from "./components/MeetingsReportDialog";
import MeetingsResultsView from "./components/MeetingsResultsView";
import MeetingsCalendarView from "./components/MeetingsCalendarView";
import MeetingsCalendarSkeleton from "./components/MeetingsCalendarSkeleton";
import MeetingsScheduleDialog from "./components/MeetingsScheduleDialog";
import MeetingsDetailDialog, {
    type MeetingDetailAction,
} from "./components/MeetingsDetailDialog";
import useMeetingsViewNavigation from "./hooks/useMeetingsViewNavigation";
import useUserCalendarEvents from "./hooks/useUserCalendarEvents";
import useAutoGridPageSize from "./hooks/useAutoGridPageSize";
import useMeetingsServerPagination from "./hooks/useMeetingsServerPagination";
import useMeetingRecord from "./hooks/useMeetingRecord";
import { isListLikeView, type MeetingsTab } from "./adapters/meetingViewModel";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { MeetingsRedesignPageProps } from "../Index";

import "@/Components/Redesign/redesign.css";
import "./meetings-redesign.css";

/** Props the list request needs back — everything else stays as rendered. */
const LIST_PROPS = ["meetings", "tabCounts", "activeTab"];

/**
 * Rows-per-page preference. Absent or "auto" means the page sizes itself to
 * the window; a number means the reader pinned that size and it is honoured
 * on every visit until they pick Auto back.
 */
const PER_PAGE_STORAGE_KEY = "hibarr_meetings_per_page";

function readStoredPageSize(): number | null {
    try {
        const stored = Number(localStorage.getItem(PER_PAGE_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : null;
    } catch {
        return null;
    }
}

/** Heights the auto page size measures with, per layout. */
const CARD_METRICS = { itemHeight: 186, gap: 16, columns: [0, 640, 1024] };
const ROW_METRICS = { itemHeight: 64, gap: 0, columns: [0] };

export default function MeetingsWorkspaceRedesign() {
    const { props } = usePage<MeetingsRedesignPageProps>();
    const {
        meetings: meetingsProp,
        tabCounts,
        activeTab,
        filterPeople,
        calendarMeetings,
        calendarRequestedMonth,
        userDeals,
        userLeads,
        meetingTypes,
        permissions,
    } = props;
    const userId = props.auth.user?.id;

    const { t } = useTranslation();
    const {
        view,
        setView,
        calendarMonth,
        setCalendarMonth,
        calendarPersonId,
        setCalendarPersonId,
        overlayTypes,
        toggleOverlayType,
    } = useMeetingsViewNavigation();

    // The viewer's own tasks/events/tickets/leave for the shown month, from
    // the endpoint the legacy My Calendar page already uses. Fetched only
    // while the calendar is open, so the list views never ask for it.
    const { events: overlayEvents } = useUserCalendarEvents(
        calendarMonth,
        view === "calendar",
    );

    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [scheduleStart, setScheduleStart] = useState<
        { date: string; startTime: string } | undefined
    >(undefined);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const detail = useMeetingRecord();
    const [detailAction, setDetailAction] =
        useState<MeetingDetailAction>("view");
    /** Meeting open in the edit form, if any. */
    const [editing, setEditing] = useState<DealFollowup | null>(null);
    /** Meeting whose follow-up report is being written, if any. */
    const [reporting, setReporting] = useState<DealFollowup | null>(null);

    /** A row's menu picks the modal; a calendar chip always opens the detail. */
    const openDetail = useCallback(
        (record: DealFollowup, action: MeetingDetailAction) => {
            setDetailAction(action);
            detail.seed(record);
        },
        [detail],
    );

    // ── Shared filters ─────────────────────────────────────────────────
    // Same workbench as Leads/Deals/Tasks: the config declares the fields,
    // `FilterContext` owns the values and writes them to the query string,
    // and the server reads them back. Nothing filter-shaped is private to
    // this page.
    const filterConfig = useMemo(
        () =>
            createMeetingFilterConfig({
                meetingTypes,
                people: filterPeople ?? [],
            }),
        [meetingTypes, filterPeople],
    );

    const { filter } = usePageSearchAndFilter({ filterConfig });
    const { openDrawer } = filter;

    // Count clauses, not raw keys, so the badge matches the filter sentence
    // (a date range is two keys but reads as one filter).
    const activeFilterCount = useMemo(
        () => describeFilters(filter.config, filter.filters).length,
        [filter.config, filter.filters],
    );

    const {
        selected,
        selectedIds,
        clearSelection,
        toggleSelect,
        toggleGroupSelection,
    } = useRowSelection();

    const canSchedule =
        permissions.add_lead_follow_up === "all" ||
        permissions.add_lead_follow_up === "added";

    // ── List navigation (tab / page / page size) ───────────────────────
    // Partial visits: only the list props come back, so the page never
    // re-renders from scratch and the scroll position holds.
    const visitList = useCallback(
        (overrides: Record<string, string | number | null>) => {
            router.get(route("meetings.index"), mergeQueryParams(overrides), {
                only: LIST_PROPS,
                preserveState: true,
                preserveScroll: true,
            });
        },
        [],
    );

    // ── Paging ─────────────────────────────────────────────────────────
    // Page N+1 is fetched in the background while page N is on screen, so
    // stepping forward paints from cache instead of waiting on a request.
    const { meetings, isPaging, goToPage, changePageSize } =
        useMeetingsServerPagination({
            meetings: meetingsProp,
            only: LIST_PROPS,
        });

    // ── Page size ──────────────────────────────────────────────────────
    // A page of meetings is as long as the window can show. Anything else
    // either cuts the last card in half on a laptop or leaves a band of
    // white on a tall monitor, and both make the pager feel arbitrary.
    const [pinnedPageSize, setPinnedPageSize] = useState<number | null>(
        readStoredPageSize,
    );
    const resultsRef = useRef<HTMLDivElement>(null);
    const metrics = view === "list" ? ROW_METRICS : CARD_METRICS;

    const autoPageSize = useAutoGridPageSize({
        enabled: pinnedPageSize === null && isListLikeView(view),
        anchorRef: resultsRef,
        itemHeight: metrics.itemHeight,
        gap: metrics.gap,
        columnBreakpoints: metrics.columns,
        minRows: 2,
    });

    useEffect(() => {
        if (autoPageSize === null) return;
        if (autoPageSize === meetings.per_page) return;
        changePageSize(autoPageSize);
    }, [autoPageSize, meetings.per_page, changePageSize]);

    const pinPageSize = (size: number) => {
        try {
            localStorage.setItem(PER_PAGE_STORAGE_KEY, String(size));
        } catch {
            // Preference is a nicety; failing to store it isn't an error.
        }
        setPinnedPageSize(size);
        changePageSize(size);
    };

    const unpinPageSize = () => {
        try {
            localStorage.removeItem(PER_PAGE_STORAGE_KEY);
        } catch {
            // As above.
        }
        setPinnedPageSize(null);
    };

    // A pinned size has to be re-applied on a fresh visit, where the URL
    // carries no per_page of its own.
    useEffect(() => {
        if (pinnedPageSize === null) return;
        if (pinnedPageSize === meetingsProp.per_page) return;
        changePageSize(pinnedPageSize);
        // Mount-only: later changes go through pinPageSize.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Calendar month data ────────────────────────────────────────────
    // The month grid is a deferred prop the server only registers for the
    // calendar view, so opening the view (or moving month) asks for that one
    // key rather than re-rendering the page.
    const requestedMonthRef = useRef<string | null>(null);
    const calendarReady = calendarMeetings?.month === calendarMonth;

    useEffect(() => {
        if (view !== "calendar" || calendarReady) return;
        // This render already registered the key for this month, so Inertia is
        // fetching it — asking again here would double the query.
        if (calendarRequestedMonth === calendarMonth) return;
        if (requestedMonthRef.current === calendarMonth) return;

        requestedMonthRef.current = calendarMonth;
        router.reload({
            only: ["calendarMeetings"],
            data: { view: "calendar", cal_month: calendarMonth },
            onStart: () => setCalendarLoading(true),
            onFinish: () => setCalendarLoading(false),
        });
    }, [view, calendarMonth, calendarReady, calendarRequestedMonth]);

    // ── Refresh ────────────────────────────────────────────────────────
    const refreshProps = useMemo(
        () =>
            view === "calendar"
                ? [...LIST_PROPS, "calendarMeetings"]
                : LIST_PROPS,
        [view],
    );

    const reloadList = useCallback(() => {
        requestedMonthRef.current = null;
        router.reload({
            only: refreshProps,
            data:
                view === "calendar"
                    ? { view: "calendar", cal_month: calendarMonth }
                    : {},
        });
    }, [refreshProps, view, calendarMonth]);

    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: () =>
            new Promise<void>((resolve) => {
                requestedMonthRef.current = null;
                router.reload({
                    only: refreshProps,
                    data:
                        view === "calendar"
                            ? { view: "calendar", cal_month: calendarMonth }
                            : {},
                    onFinish: () => resolve(),
                });
            }),
    });

    const openSchedule = (start?: { date: string; startTime: string }) => {
        setScheduleStart(start);
        setScheduleOpen(true);
    };

    return (
        <PageLayout
            title={t("app.menu.meetings")}
            breadcrumbs={[{ name: t("app.menu.meetings") }]}
            mainContentClassName="p-0"
        >
            <MeetingsHeader
                view={view}
                onViewChange={setView}
                showTabs={isListLikeView(view)}
                tab={activeTab}
                onTabChange={(tab: MeetingsTab) =>
                    visitList({ tab, page: null })
                }
                counts={tabCounts}
                onRefresh={refresh}
                refreshing={isRefreshing}
                onSchedule={() => openSchedule()}
                canSchedule={canSchedule}
                filtersCount={activeFilterCount}
                onOpenFilters={openDrawer}
                filtersLabel={t("app.filter")}
                // Only when something actually narrows the list: the header
                // renders the band around whatever it is given, so passing an
                // element that renders nothing would leave an empty grey strip.
                filterSentence={
                    activeFilterCount > 0 ? (
                        <ActiveFilterSentence
                            count={meetings.total}
                            entityLabel="meetings"
                            onOpenFilters={openDrawer}
                        />
                    ) : undefined
                }
            />

            <div
                className="mx-auto w-full max-w-screen-2xl px-6 py-6"
                style={{ fontFamily: REDESIGN_FONT_STACK }}
            >
                {isListLikeView(view) && (
                    <MeetingsBulkBar
                        selectedIds={selectedIds}
                        clearSelection={clearSelection}
                        onChanged={reloadList}
                        canEdit={permissions.edit_lead_follow_up !== "none"}
                        canDelete={permissions.delete_lead_follow_up !== "none"}
                    />
                )}

                {isListLikeView(view) ? (
                    <MeetingsResultsView
                        ref={resultsRef}
                        layout={view === "list" ? "list" : "cards"}
                        meetings={meetings}
                        tab={activeTab}
                        permissions={permissions}
                        userId={userId}
                        onView={(m) => openDetail(m, "view")}
                        onEdit={(m) => setEditing(m)}
                        onReport={(m) => setReporting(m)}
                        onDelete={(m) => openDetail(m, "delete")}
                        onPageChange={goToPage}
                        onPageSizeChange={pinPageSize}
                        autoPageSize={pinnedPageSize === null}
                        onAutoPageSize={unpinPageSize}
                        selected={selected}
                        onToggleSelect={toggleSelect}
                        onToggleAll={toggleGroupSelection}
                        isPaging={isPaging}
                    />
                ) : calendarMeetings && calendarReady && !calendarLoading ? (
                    <MeetingsCalendarView
                        data={calendarMeetings}
                        personId={calendarPersonId}
                        onPersonChange={setCalendarPersonId}
                        onMonthChange={setCalendarMonth}
                        overlayEvents={overlayEvents}
                        visibleOverlayTypes={overlayTypes}
                        onToggleOverlayType={toggleOverlayType}
                        currentUserId={userId}
                        onSelectMeeting={(meetingId) => {
                            setDetailAction("view");
                            detail.open(meetingId);
                        }}
                        onCreateAt={
                            canSchedule
                                ? (dayKey) =>
                                      openSchedule({
                                          date: dayKey,
                                          startTime: "09:00",
                                      })
                                : undefined
                        }
                    />
                ) : (
                    <MeetingsCalendarSkeleton />
                )}
            </div>

            <MeetingsScheduleDialog
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                onScheduled={reloadList}
                userDeals={userDeals}
                userLeads={userLeads}
                meetingTypes={meetingTypes}
                initialStart={scheduleStart}
            />

            <MeetingsDetailDialog
                meeting={detail.meeting}
                action={detailAction}
                permissions={permissions}
                userId={userId}
                onClose={detail.close}
                onChanged={reloadList}
                onEdit={(record) => {
                    detail.close();
                    setEditing(record);
                }}
            />

            <MeetingsEditDialog
                open={editing !== null}
                meeting={editing}
                meetingTypes={meetingTypes}
                onClose={() => setEditing(null)}
                onSaved={reloadList}
            />

            <MeetingsReportDialog
                open={reporting !== null}
                meeting={reporting}
                onClose={() => setReporting(null)}
                onSaved={reloadList}
            />

            {/* Two-pane filter workbench — the same one Leads, Deals and
                Tasks use, with the full feature set: facet counts beside
                each option, and saved views that can be pinned and shared
                with the team. */}
            <EntityFilterModal
                config={filterConfig}
                optionsLoading={filterPeople === undefined}
                entityLabel="meetings"
                currentCount={meetings.total}
                savedViews
                savedViewEntity="meeting"
            />
        </PageLayout>
    );
}
