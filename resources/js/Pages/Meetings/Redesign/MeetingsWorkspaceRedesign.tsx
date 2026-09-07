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
import MeetingsUpcomingStrip from "./components/MeetingsUpcomingStrip";
import MeetingsCalendarView, {
    chipTone,
    type CalendarDayBuckets,
} from "./components/MeetingsCalendarView";
import MeetingsDayDialog from "./components/MeetingsDayDialog";
import MeetingsCalendarSkeleton from "./components/MeetingsCalendarSkeleton";
import MeetingsScheduleDialog from "./components/MeetingsScheduleDialog";
import MeetingsDetailDialog, {
    type MeetingDetailAction,
} from "./components/MeetingsDetailDialog";
import useMeetingsViewNavigation from "./hooks/useMeetingsViewNavigation";
import useUserCalendarEvents from "./hooks/useUserCalendarEvents";
import useZohoCalendarEvents from "./hooks/useZohoCalendarEvents";
import useAutoGridPageSize, {
    type AutoGridLayout,
} from "./hooks/useAutoGridPageSize";
import useMeetingsServerPagination from "./hooks/useMeetingsServerPagination";
import useMeetingRecord from "./hooks/useMeetingRecord";
import { type MeetingsTab } from "./adapters/meetingViewModel";
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

/**
 * Cookie the server reads on a cold page load to size the first page to the
 * window. A cookie rather than localStorage precisely because the server has
 * to see it before any JS has run.
 */
const PAGE_SIZE_HINT_COOKIE = "hibarr_meetings_per_page_hint";

function rememberPageSizeHint(size: number): void {
    try {
        document.cookie = `${PAGE_SIZE_HINT_COOKIE}=${size}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
        // A hint is a nicety; a browser refusing cookies just means the page
        // sizes itself on the second request, as it did before.
    }
}

/**
 * "Next up" cards are optional — on by default, remembered per browser.
 *
 * A cookie rather than localStorage because the *server* needs it: whatever
 * the strip shows is left out of the list so a meeting is never on the page
 * twice, which makes this preference part of the query.
 */
const NEXT_UP_COOKIE = "hibarr_meetings_next_up";

function readStripVisible(): boolean {
    try {
        return !document.cookie
            .split("; ")
            .some((entry) => entry === `${NEXT_UP_COOKIE}=0`);
    } catch {
        // Blocked storage — showing them is the friendlier default.
        return true;
    }
}

function writeStripVisible(visible: boolean): void {
    try {
        document.cookie = `${NEXT_UP_COOKIE}=${visible ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
        // As above — the toggle still works for this render either way.
    }
}

function readStoredPageSize(): number | null {
    try {
        const stored = Number(localStorage.getItem(PER_PAGE_STORAGE_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : null;
    } catch {
        return null;
    }
}

/** Heights the auto page size measures with, per layout. */
/** The layout the page is drawn in, measured so the pager stays on screen. */
const LIST_LAYOUTS: AutoGridLayout[] = [
    // Rows: always one column, no gap between them. Measured a little taller
    // than a row actually is, to pay for the day separators between them —
    // over-estimating costs a row of whitespace, under-estimating costs a
    // pager below the fold. The table row carries two two-line columns (the
    // record + its subtitle, the status pill + its countdown), so this has to
    // clear that, not the old single-line row's height.
    { itemHeight: 84, gap: 0, columnBreakpoints: [0] },
];

export default function MeetingsWorkspaceRedesign() {
    const { props } = usePage<MeetingsRedesignPageProps>();
    const {
        meetings: meetingsProp,
        tabCounts,
        activeTab,
        filterPeople,
        calendarMeetings,
        calendarRequestedMonth,
        upcomingSoon,
        hasAnyMeetings,
        userDeals,
        userLeads,
        meetingTypes,
        permissions,
    } = props;
    const userId = props.auth.user?.id;
    // The Zoho Calendar overlay is announced but not built. It is shown only
    // to HIBARR staff, as a disabled "coming soon" chip — so the team can see
    // it landing without it reaching customers as a control that does
    // nothing. Drop the domain test once the integration actually works.
    const zohoAvailable = (props.auth.user?.email ?? "")
        .toLowerCase()
        .endsWith("@hibarr.de");

    const { t } = useTranslation();
    const {
        view,
        setView,
        calendarMonth,
        setCalendarMonth,
        overlayTypes,
        toggleOverlayType,
    } = useMeetingsViewNavigation();

    // The viewer's own tasks/events/tickets/leave for the shown month, from
    // the endpoint the legacy My Calendar page already uses. Fetched only
    // while the calendar is open, so the list views never ask for it.
    const { events: crmOverlayEvents } = useUserCalendarEvents(
        calendarMonth,
        view === "calendar",
    );

    // The viewer's connected Zoho Calendar, in the same row shape, fetched
    // only while the calendar is open and only while that toggle is on — a
    // third-party round trip nobody asked to see is a round trip not worth
    // making.
    // Disabled outright while the toggle is a placeholder: an announcement
    // should not be quietly calling a third-party API behind the chip.
    const { events: zohoEvents } = useZohoCalendarEvents(calendarMonth, false);

    const overlayEvents = useMemo(
        () => [...crmOverlayEvents, ...zohoEvents],
        [crmOverlayEvents, zohoEvents],
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
    const [stripVisible, setStripVisible] = useState<boolean>(readStripVisible);
    /** Day whose "+N more" was opened, and the grid's grouped days. */
    const [openDay, setOpenDay] = useState<{
        key: string;
        label: string;
    } | null>(null);
    const [dayBuckets, setDayBuckets] = useState<CalendarDayBuckets>({
        meetings: new Map(),
        overlay: new Map(),
    });

    // Hiding the strip has to give its meetings back to the list, and showing
    // it has to take them away again — both are server-side, so the toggle
    // re-reads the list rather than only flipping a local flag.
    const toggleStrip = () => {
        const next = !stripVisible;
        writeStripVisible(next);
        setStripVisible(next);
        router.reload({ only: [...LIST_PROPS, "upcomingSoon"] });
    };

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
    // A page of meetings is as long as the window can show — no half-visible
    // last card on a laptop, no band of white on a tall monitor, and the
    // pager always in view rather than somewhere below the fold.
    const [pinnedPageSize, setPinnedPageSize] = useState<number | null>(
        readStoredPageSize,
    );
    const resultsRef = useRef<HTMLDivElement>(null);
    /** Last size actually asked of the server, so it is never asked twice. */
    const requestedPageSizeRef = useRef<number | null>(null);
    const autoPageSize = useAutoGridPageSize({
        // Held back until the "next up" cards have landed and taken their
        // vertical space. Measuring before that reads a taller list than
        // there will be, and then corrects itself a second time once the
        // cards push it down — two requests and a visible reflow for a
        // number that could have been right the first time.
        enabled:
            pinnedPageSize === null &&
            view === "list" &&
            (!stripVisible || upcomingSoon !== undefined),
        anchorRef: resultsRef,
        layouts: LIST_LAYOUTS,
        minRows: 2,
    });

    useEffect(() => {
        if (autoPageSize === null) return;

        // Tell the server what fits, so the *next* first paint arrives at the
        // right size instead of always costing a second request. Read back in
        // MeetingsController::index() when the URL names no per_page.
        rememberPageSizeHint(autoPageSize);

        // Applied in both directions. A page longer than the window is the
        // one outcome worth spending a request to correct: it pushes the
        // pager off screen, so changing page means scrolling to find it
        // first. Resizes are debounced, so dragging a window costs one
        // request when it settles, not one per frame.
        if (autoPageSize === meetings.per_page) return;

        // Asked for once per settled size. Without this, a response that the
        // server clamps to something else would be re-requested on every
        // render, which is a request loop rather than a correction.
        if (requestedPageSizeRef.current === autoPageSize) return;
        requestedPageSizeRef.current = autoPageSize;

        changePageSize(autoPageSize, { silent: true });
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
            // Merged, not replaced: `data` on its own would send the month
            // without the active filters, and the server would answer with an
            // unfiltered month — the calendar quietly showing more than the
            // list beside it.
            data: mergeQueryParams({
                view: "calendar",
                cal_month: calendarMonth,
            }),
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

    /** Current query string plus the calendar's month, so filters survive. */
    const reloadParams = useCallback(
        () =>
            mergeQueryParams(
                view === "calendar"
                    ? { view: "calendar", cal_month: calendarMonth }
                    : {},
            ),
        [view, calendarMonth],
    );

    const reloadList = useCallback(() => {
        requestedMonthRef.current = null;
        router.reload({ only: refreshProps, data: reloadParams() });
    }, [refreshProps, reloadParams]);

    const { refresh, isRefreshing } = usePageRefresh({
        onRefresh: () =>
            new Promise<void>((resolve) => {
                requestedMonthRef.current = null;
                router.reload({
                    only: refreshProps,
                    data: reloadParams(),
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
                showTabs={view === "list"}
                tab={activeTab}
                onTabChange={(tab: MeetingsTab) =>
                    visitList({ tab, page: null })
                }
                counts={tabCounts}
                onRefresh={refresh}
                refreshing={isRefreshing}
                onSchedule={() => openSchedule()}
                canSchedule={canSchedule}
                stripVisible={stripVisible}
                onToggleStrip={toggleStrip}
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
                {view === "list" && stripVisible && (
                    <MeetingsUpcomingStrip
                        meetings={upcomingSoon}
                        permissions={permissions}
                        userId={userId}
                        onView={(m) => openDetail(m, "view")}
                        onEdit={(m) => setEditing(m)}
                        onDelete={(m) => openDetail(m, "delete")}
                        onReport={(m) => setReporting(m)}
                        onSchedule={() => openSchedule()}
                        canSchedule={canSchedule}
                    />
                )}

                {view === "list" && (
                    <MeetingsBulkBar
                        selectedIds={selectedIds}
                        clearSelection={clearSelection}
                        onChanged={reloadList}
                        canEdit={permissions.edit_lead_follow_up !== "none"}
                        canDelete={permissions.delete_lead_follow_up !== "none"}
                    />
                )}

                {view === "list" ? (
                    <MeetingsResultsView
                        ref={resultsRef}
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
                        onSchedule={() => openSchedule()}
                        canSchedule={canSchedule}
                        hasAnyMeetings={hasAnyMeetings}
                        allInCards={
                            meetings.total === 0 && tabCounts[activeTab] > 0
                        }
                    />
                ) : calendarMeetings && calendarReady && !calendarLoading ? (
                    <MeetingsCalendarView
                        data={calendarMeetings}
                        onMonthChange={setCalendarMonth}
                        overlayEvents={overlayEvents}
                        visibleOverlayTypes={overlayTypes}
                        onToggleOverlayType={toggleOverlayType}
                        zohoAvailable={zohoAvailable}
                        onSelectMeeting={(meetingId) => {
                            setDetailAction("view");
                            detail.open(meetingId);
                        }}
                        onOpenDay={setOpenDay}
                        onBuckets={setDayBuckets}
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
                loading={detail.loading}
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

            <MeetingsDayDialog
                day={openDay}
                meetings={
                    openDay ? (dayBuckets.meetings.get(openDay.key) ?? []) : []
                }
                overlay={
                    openDay ? (dayBuckets.overlay.get(openDay.key) ?? []) : []
                }
                toneOf={chipTone}
                onClose={() => setOpenDay(null)}
                onSelectMeeting={(meetingId) => {
                    setOpenDay(null);
                    setDetailAction("view");
                    detail.open(meetingId);
                }}
                onCreate={
                    canSchedule && openDay
                        ? () => {
                              const day = openDay;
                              setOpenDay(null);
                              openSchedule({
                                  date: day.key,
                                  startTime: "09:00",
                              });
                          }
                        : undefined
                }
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
