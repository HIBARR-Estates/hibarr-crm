import { forwardRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type {
    DealFollowup,
    PaginatedFollowupResponse,
} from "@/Types/api/deal-followup";
import MeetingCard from "./MeetingCard";
import MeetingLiveCard from "./MeetingLiveCard";
import MeetingRow from "./MeetingRow";
import MeetingsListHeader from "./MeetingsListHeader";
import { meetingBucket, type MeetingsTab } from "../adapters/meetingViewModel";

interface MeetingsResultsViewProps {
    /** Card grid or one-line rows — the same page of meetings either way. */
    layout: "cards" | "list";
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
}

/** Copy per tab — an empty "Live" reads very differently from an empty "Past". */
const EMPTY_COPY: Record<MeetingsTab, { title: string; body: string }> = {
    all: {
        title: "No meetings yet",
        body: "Meetings you book with leads and deals will appear here.",
    },
    upcoming: {
        title: "No meetings scheduled",
        body: "Meetings you book with leads and deals will appear here.",
    },
    past: {
        title: "No past meetings",
        body: "Meetings that have finished will be listed here.",
    },
};

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
        layout,
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
    },
    ref,
) {
    const { td } = useTd();
    const { timezone } = useUserDateTime();

    if (meetings.data.length === 0) {
        const copy = EMPTY_COPY[tab];
        return (
            <div ref={ref}>
                <EmptyState
                    icon="calendar"
                    title={td(copy.title)}
                    description={td(copy.body)}
                />
            </div>
        );
    }

    const pageIds = meetings.data.map((meeting) => meeting.id);
    const allSelected = pageIds.every((id) => selected.has(id));

    // A meeting in progress is lifted out of the grid/list into its own
    // full-width banner above it — the same treatment in either layout, since
    // "happening right now" outranks whichever arrangement was chosen.
    const buckets = meetings.data.map((meeting) => ({
        meeting,
        bucket: meetingBucket(meeting, timezone),
    }));
    const liveMeetings = buckets.filter(({ bucket }) => bucket === "live");
    const restMeetings = buckets.filter(({ bucket }) => bucket !== "live");

    const handlers = (meeting: DealFollowup) => ({
        onView: () => onView(meeting),
        onEdit: () => onEdit(meeting),
        onDelete: () => onDelete(meeting),
        onReport: () => onReport(meeting),
    });

    const items = restMeetings.map(({ meeting, bucket }) => {
        const shared = {
            key: meeting.id,
            meeting,
            bucket,
            permissions,
            userId,
            ...handlers(meeting),
            selected: selected.has(meeting.id),
            onToggleSelect: () => onToggleSelect(meeting.id),
        };
        return layout === "cards" ? (
            <MeetingCard {...shared} />
        ) : (
            <MeetingRow {...shared} />
        );
    });

    const liveBanner =
        liveMeetings.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3">
                {liveMeetings.map(({ meeting }) => (
                    <MeetingLiveCard
                        key={meeting.id}
                        meeting={meeting}
                        permissions={permissions}
                        userId={userId}
                        {...handlers(meeting)}
                    />
                ))}
            </div>
        ) : null;

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
                {liveBanner}

                {items.length === 0 ? null : layout === "cards" ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {items}
                    </div>
                ) : (
                    <div
                        className="overflow-hidden"
                        style={{
                            background: T.WHITE,
                            border: `1px solid ${T.BORDER}`,
                            borderRadius: 10,
                        }}
                    >
                        <MeetingsListHeader
                            allSelected={allSelected}
                            onToggleAll={() =>
                                onToggleAll(pageIds, !allSelected)
                            }
                        />
                        {items}
                    </div>
                )}
            </div>

            <div className={layout === "cards" ? "mt-4" : undefined}>
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
