import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import usePageRefresh from "@/Hooks/usePageRefresh";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Deal } from "@/Types/api/deals";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import EditFollowup from "@/Pages/Deals/Components/Tabs/followups/EditFollowup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import MeetingsHeader from "./components/MeetingsHeader";
import MeetingsStats from "./components/MeetingsStats";
import MeetingsFilterBar from "./components/MeetingsFilterBar";
import MeetingsActiveFilters from "./components/MeetingsActiveFilters";
import MeetingsCardsView from "./components/MeetingsCardsView";
import MeetingsCalendarView from "./components/MeetingsCalendarView";
import MeetingsCalendarSkeleton from "./components/MeetingsCalendarSkeleton";
import MeetingsScheduleDialog from "./components/MeetingsScheduleDialog";
import useMeetingsViewNavigation from "./hooks/useMeetingsViewNavigation";
import useUserCalendarEvents from "./hooks/useUserCalendarEvents";
import type { MeetingsTab } from "./adapters/meetingViewModel";
import type { MeetingsRedesignPageProps } from "../Index";

import "@/Components/Redesign/redesign.css";
import "./meetings-redesign.css";

/** Props the list request needs back — everything else stays as rendered. */
const LIST_PROPS = ["meetings", "tabCounts", "activeTab", "overviewStats"];

export default function MeetingsWorkspaceRedesign() {
    const { props } = usePage<MeetingsRedesignPageProps>();
    const {
        overviewStats,
        meetings,
        tabCounts,
        activeTab,
        meetingFilters,
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
        statsVisible,
        toggleStats,
        overlayTypes,
        toggleOverlayType,
    } = useMeetingsViewNavigation();

    // The viewer's own tasks/events/tickets/leave for the shown month, from
    // the endpoint the legacy My Calendar page already uses. Fetched only
    // while the calendar is open, so the cards view never asks for it.
    const { events: overlayEvents } = useUserCalendarEvents(
        calendarMonth,
        view === "calendar",
    );

    const [scheduleOpen, setScheduleOpen] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(false);
    const {
        action,
        handleAction,
        handleClose,
        selected: meeting,
    } = useGenericEntityAction<DealFollowup>();

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

    const { persistPageSize } = usePersistedPageSize({
        storageKey: "hibarr_meetings_per_page",
        currentPerPage: meetings.per_page,
        onRestore: (perPage) => visitList({ per_page: perPage, page: null }),
    });

    const handlePageSizeChange = (size: number) => {
        persistPageSize(size);
        visitList({ per_page: size, page: null });
    };

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

    const reloadAfterSchedule = () => {
        requestedMonthRef.current = null;
        router.reload({ only: refreshProps });
    };

    const meetingDeal = meeting?.deal as Deal | undefined;
    const meetingLead = meeting?.lead;

    return (
        <PageLayout
            title={t("app.menu.meetings")}
            breadcrumbs={[{ name: t("app.menu.meetings") }]}
            mainContentClassName="p-0"
        >
            <div
                style={{
                    background: T.WHITE,
                    borderBottom: `1px solid ${T.BORDER}`,
                    position: "sticky",
                    top: 0,
                    zIndex: 15,
                }}
            >
                <div className="mx-auto w-full max-w-7xl px-7 pt-4">
                    <MeetingsHeader
                        view={view}
                        onViewChange={setView}
                        onRefresh={refresh}
                        refreshing={isRefreshing}
                        onSchedule={() => setScheduleOpen(true)}
                        canSchedule={canSchedule}
                    />
                </div>
            </div>

            <div className="mx-auto w-full max-w-7xl px-7 pb-[60px] pt-6">
                {statsVisible && <MeetingsStats stats={overviewStats} />}

                <MeetingsFilterBar
                    showTabs={view === "cards"}
                    tab={activeTab}
                    onTabChange={(tab: MeetingsTab) =>
                        visitList({ tab, page: null })
                    }
                    counts={tabCounts}
                    statsVisible={statsVisible}
                    onToggleStats={toggleStats}
                />

                {view === "cards" && (
                    <MeetingsActiveFilters
                        filters={meetingFilters}
                        onClear={() =>
                            visitList({
                                attendance: null,
                                date_from: null,
                                date_to: null,
                                page: null,
                            })
                        }
                    />
                )}

                {view === "cards" ? (
                    <MeetingsCardsView
                        meetings={meetings}
                        tab={activeTab}
                        permissions={permissions}
                        userId={userId}
                        onView={(m) => handleAction("view", m)}
                        onEdit={(m) => handleAction("edit", m)}
                        onDelete={(m) => handleAction("delete", m)}
                        onPageChange={(page) => visitList({ page })}
                        onPageSizeChange={handlePageSizeChange}
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
                    />
                ) : (
                    <MeetingsCalendarSkeleton />
                )}
            </div>

            <MeetingsScheduleDialog
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                onScheduled={reloadAfterSchedule}
                userDeals={userDeals}
                userLeads={userLeads}
                meetingTypes={meetingTypes}
            />

            {meeting && (meetingDeal || meetingLead) && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose()}
                    followup={meeting}
                    deal={meetingDeal}
                    lead={meetingLead}
                    onEdit={() => handleAction("edit", meeting)}
                />
            )}

            {meeting && meetingDeal && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={meetingDeal}
                    followup={meeting}
                />
            )}

            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={meeting}
            />
        </PageLayout>
    );
}
