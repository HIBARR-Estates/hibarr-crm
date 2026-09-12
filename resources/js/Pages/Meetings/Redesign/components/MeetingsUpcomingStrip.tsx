import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import MeetingCard from "./MeetingCard";
import MeetingLiveCard from "./MeetingLiveCard";
import { meetingBucket } from "../adapters/meetingViewModel";

interface MeetingsUpcomingStripProps {
    /** The next few meetings, soonest first. Undefined while deferred. */
    meetings?: DealFollowup[];
    permissions: Record<string, string>;
    userId?: number;
    onView: (meeting: DealFollowup) => void;
    onEdit: (meeting: DealFollowup) => void;
    onDelete: (meeting: DealFollowup) => void;
    onReport: (meeting: DealFollowup) => void;
    /** Books a new meeting — the quick action on the empty state. */
    onSchedule: () => void;
    canSchedule: boolean;
}

/**
 * The "next up" cards above the list.
 *
 * The list answers "what have I got"; these answer "what is about to happen",
 * which is a different question and the one people open this page with. Three
 * at the widest layout, dropping to two and then one as columns disappear —
 * the count follows the grid rather than being decided up front, so a card is
 * never squeezed to fit.
 *
 * A meeting that is running right now takes the full width in red instead:
 * at that point there is nothing else on the page worth the same weight.
 */
export default function MeetingsUpcomingStrip({
    meetings,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onReport,
    onSchedule,
    canSchedule,
}: MeetingsUpcomingStripProps) {
    const { timezone } = useUserDateTime();
    const { td } = useTd();

    // Undefined is "still loading" and says nothing; an empty array is a
    // real answer — there is nothing next — and deserves to be said.
    if (!meetings) return null;

    const handlers = (meeting: DealFollowup) => ({
        permissions,
        userId,
        onView: () => onView(meeting),
        onEdit: () => onEdit(meeting),
        onDelete: () => onDelete(meeting),
        onReport: () => onReport(meeting),
    });

    if (meetings.length === 0) {
        return (
            <section className="mb-5" aria-label={td("Next meetings")}>
                <StripHeading label={td("Next up")} />
                <EmptyState
                    icon="calendar"
                    title={td("No more upcoming meetings")}
                    description={td(
                        "Everything on your calendar has already happened. Book the next one when you are ready.",
                    )}
                    action={
                        canSchedule
                            ? {
                                  label: td("Schedule a meeting"),
                                  onClick: onSchedule,
                              }
                            : undefined
                    }
                />
            </section>
        );
    }

    const buckets = meetings.map((meeting) => ({
        meeting,
        bucket: meetingBucket(meeting, timezone),
    }));
    const live = buckets.filter(({ bucket }) => bucket === "live");
    const upcoming = buckets.filter(({ bucket }) => bucket === "upcoming");

    return (
        <section className="mb-5" aria-label={td("Next meetings")}>
            <StripHeading
                label={live.length > 0 ? td("Happening now") : td("Next up")}
            />

            {live.length > 0 && (
                <div className="mb-3 flex flex-col gap-3">
                    {live.map(({ meeting }) => (
                        <MeetingLiveCard
                            key={meeting.id}
                            meeting={meeting}
                            {...handlers(meeting)}
                        />
                    ))}
                </div>
            )}

            {upcoming.length > 0 && (
                <>
                    {live.length > 0 && (
                        <StripHeading label={td("Next up")} />
                    )}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {upcoming.map(({ meeting, bucket }) => (
                            <MeetingCard
                                key={meeting.id}
                                meeting={meeting}
                                bucket={bucket}
                                // Selection is a list concern; these cards are a
                                // shortcut, not rows you act on in bulk.
                                selectable={false}
                                {...handlers(meeting)}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

/** The strip's small section label, shared by its filled and empty states. */
function StripHeading({ label }: { label: string }) {
    return (
        <h2
            className="mb-2.5 font-bold uppercase"
            style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                color: T.TEXT_HINT,
            }}
        >
            {label}
        </h2>
    );
}
