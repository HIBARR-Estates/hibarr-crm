import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import type {
    DealFollowup,
    PaginatedFollowupResponse,
} from "@/Types/api/deal-followup";
import MeetingCard from "./MeetingCard";
import {
    meetingBucket,
    type MeetingsTab,
} from "../adapters/meetingViewModel";

interface MeetingsCardsViewProps {
    meetings: PaginatedFollowupResponse;
    tab: MeetingsTab;
    permissions: Record<string, string>;
    userId?: number;
    onView: (meeting: DealFollowup) => void;
    onEdit: (meeting: DealFollowup) => void;
    onDelete: (meeting: DealFollowup) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
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
    live: {
        title: "Nothing live right now",
        body: "A meeting shows here while it is in progress.",
    },
    past: {
        title: "No past meetings",
        body: "Meetings that have finished will be listed here.",
    },
};

export default function MeetingsCardsView({
    meetings,
    tab,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onPageChange,
    onPageSizeChange,
}: MeetingsCardsViewProps) {
    const { td } = useTd();
    const { timezone } = useUserDateTime();

    if (meetings.data.length === 0) {
        const copy = EMPTY_COPY[tab];
        return (
            <EmptyState
                icon="calendar"
                title={td(copy.title)}
                description={td(copy.body)}
            />
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {meetings.data.map((meeting) => (
                    <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        bucket={meetingBucket(meeting, timezone)}
                        permissions={permissions}
                        userId={userId}
                        onView={() => onView(meeting)}
                        onEdit={() => onEdit(meeting)}
                        onDelete={() => onDelete(meeting)}
                    />
                ))}
            </div>

            <div className="mt-4">
                <Pagination
                    page={meetings.current_page}
                    pageSize={meetings.per_page}
                    totalItems={meetings.total}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    itemLabel="meeting"
                    itemLabelPlural="meetings"
                />
            </div>
        </>
    );
}
