import { forwardRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type {
    DealFollowup,
    PaginatedFollowupResponse,
} from "@/Types/api/deal-followup";
import MeetingRow from "./MeetingRow";
import MeetingsListHeader from "./MeetingsListHeader";
import {
    meetingBucket,
    meetingDayKey,
    meetingDayLabel,
    type MeetingsTab,
} from "../adapters/meetingViewModel";

interface MeetingsResultsViewProps {
    meetings: PaginatedFollowupResponse;
    tab: MeetingsTab;
    permissions: Record<string, string>;
    userId?: number;
    onView: (meeting: DealFollowup) => void;
    onEdit: (meeting: DealFollowup) => void;
    onDelete: (meeting: DealFollowup) => void;
    /** Opens the post-meeting report form. */
    onReport: (meeting: DealFollowup) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    /** True while the page size follows the window height. */
    autoPageSize: boolean;
    onAutoPageSize: () => void;
    selected: Set<number>;
    onToggleSelect: (meetingId: number) => void;
    /** Selects or clears every meeting on the current page. */
    onToggleAll: (ids: number[], select: boolean) => void;
    /** Dimmed while a page navigation that missed the prefetch is in flight. */
    isPaging: boolean;
    /** Books a new meeting — the quick action on the empty state. */
    onSchedule: () => void;
    canSchedule: boolean;
    /** False only for someone who has never had a meeting at all. */
    hasAnyMeetings: boolean;
    /** True when the tab has meetings but every one is up in the cards. */
    allInCards: boolean;
}

/**
 * Copy per tab, and per whether this person has ever had a meeting.
 *
 * "No meetings scheduled" is onboarding copy — true for someone who has never
 * booked one, wrong for someone who has simply worked through their calendar.
 * They have earned "no more upcoming meetings", which says the list is
 * finished rather than that nothing was ever there.
 */
function emptyCopy(
    tab: MeetingsTab,
    hasAnyMeetings: boolean,
    allInCards: boolean,
): { title: string; body: string } {
    // The tab still counts them, because they are still yours — they have
    // just been lifted into the cards above rather than repeated down here.
    // Saying "all caught up" over a meeting visible on the same screen would
    // plainly contradict itself.
    if (allInCards) {
        return {
            title: "That is everything",
            body: "Your remaining meetings are in the cards above.",
        };
    }

    if (tab === "past") {
        return {
            title: "No past meetings",
            body: "Meetings that have finished will be listed here.",
        };
    }

    if (!hasAnyMeetings) {
        return {
            title: "No meetings scheduled",
            body: "Meetings you book with leads and deals will appear here.",
        };
    }

    return tab === "upcoming"
        ? {
              title: "No more upcoming meetings",
              body: "You are all caught up. Past meetings are still on the Past tab.",
          }
        : {
              title: "Nothing left to show",
              body: "Every meeting matching this view has been dealt with.",
          };
}

/**
 * The paginated meetings, as cards or as rows.
 *
 * The forwarded ref is the element the auto page size measures from — it has
 * to be the results container itself, since the space a page has is whatever
 * is left between its own top edge and the bottom of the window.
 */
const MeetingsResultsView = forwardRef<
    HTMLDivElement,
    MeetingsResultsViewProps
>(function MeetingsResultsView(
    {
        meetings,
        tab,
        permissions,
        userId,
        onView,
        onEdit,
        onDelete,
        onReport,
        onPageChange,
        onPageSizeChange,
        autoPageSize,
        onAutoPageSize,
        selected,
        onToggleSelect,
        onToggleAll,
        isPaging,
        onSchedule,
        canSchedule,
        hasAnyMeetings,
        allInCards,
    },
    ref,
) {
    const { td } = useTd();
    const { timezone } = useUserDateTime();

    // Folded days, by day key. Local and deliberately not persisted: it is a
    // way to get one day out of the way while reading, not a preference.
    const [collapsedDays, setCollapsedDays] = useState<Set<string>>(
        () => new Set(),
    );

    const toggleDay = (key: string) =>
        setCollapsedDays((current) => {
            const next = new Set(current);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    if (meetings.data.length === 0) {
        const copy = emptyCopy(tab, hasAnyMeetings, allInCards);
        return (
            <div ref={ref}>
                <EmptyState
                    icon="calendar"
                    title={td(copy.title)}
                    description={td(copy.body)}
                    action={
                        canSchedule && !allInCards
                            ? {
                                  label: td("Schedule a meeting"),
                                  onClick: onSchedule,
                              }
                            : undefined
                    }
                />
            </div>
        );
    }

    const pageIds = meetings.data.map((meeting) => meeting.id);
    const allSelected = pageIds.every((id) => selected.has(id));

    // The date is hoisted out of every row into a separator that appears only
    // when the day changes. Four rows all stamped "Sat 29 Aug" spend four
    // lines saying one thing; this says it once, gives the rows their width
    // back, and gives the day something to fold into.
    const days: Array<{
        key: string;
        label: string;
        meetings: DealFollowup[];
    }> = [];
    meetings.data.forEach((meeting) => {
        const key = meetingDayKey(meeting.next_follow_up_date, timezone);
        const current = days[days.length - 1];
        if (current?.key === key) {
            current.meetings.push(meeting);
            return;
        }
        days.push({
            key,
            label: meetingDayLabel(meeting.next_follow_up_date, timezone),
            meetings: [meeting],
        });
    });

    return (
        <>
            <div
                ref={ref}
                // Only a page that missed the prefetch dims; a cached page is
                // painted straight away and never flickers.
                style={{
                    opacity: isPaging ? 0.55 : 1,
                    transition: "opacity 120ms ease",
                }}
            >
                <div
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        // Square at the bottom: the pager sits directly
                        // beneath and the two read as one surface.
                        borderRadius: "10px 10px 0 0",
                        borderBottom: "none",
                        overflow: "hidden",
                    }}
                >
                    <MeetingsListHeader
                        allSelected={allSelected}
                        onToggleAll={() => onToggleAll(pageIds, !allSelected)}
                    />

                    {days.map((day) => {
                        const collapsed = collapsedDays.has(day.key);
                        return (
                            <div key={day.key}>
                                <button
                                    type="button"
                                    onClick={() => toggleDay(day.key)}
                                    aria-expanded={!collapsed}
                                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left font-semibold uppercase"
                                    style={{
                                        fontSize: 11,
                                        letterSpacing: "0.06em",
                                        color: T.TEXT_MUTED,
                                        background: T.SURFACE_2,
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                        border: "none",
                                        borderBottomWidth: 1,
                                        borderBottomStyle: "solid",
                                        borderBottomColor: T.BORDER_SOFT,
                                        cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <Icon
                                        name={
                                            collapsed
                                                ? "chevron-right"
                                                : "chevron-down"
                                        }
                                        size={12}
                                    />
                                    {td(day.label)}
                                    <span
                                        className="font-semibold"
                                        style={{ color: T.TEXT_HINT }}
                                    >
                                        {day.meetings.length}
                                    </span>
                                </button>

                                {!collapsed &&
                                    day.meetings.map((meeting) => (
                                        <MeetingRow
                                            key={meeting.id}
                                            meeting={meeting}
                                            bucket={meetingBucket(
                                                meeting,
                                                timezone,
                                            )}
                                            permissions={permissions}
                                            userId={userId}
                                            onView={() => onView(meeting)}
                                            onEdit={() => onEdit(meeting)}
                                            onDelete={() => onDelete(meeting)}
                                            onReport={() => onReport(meeting)}
                                            selected={selected.has(meeting.id)}
                                            onToggleSelect={() =>
                                                onToggleSelect(meeting.id)
                                            }
                                        />
                                    ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div>
                <Pagination
                    page={meetings.current_page}
                    pageSize={meetings.per_page}
                    totalItems={meetings.total}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    itemLabel="meeting"
                    itemLabelPlural="meetings"
                    allowAutoPageSize
                    autoPageSize={autoPageSize}
                    onAutoPageSize={onAutoPageSize}
                />
            </div>
        </>
    );
});

export default MeetingsResultsView;
