import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
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
    /** False only for someone who has never had a meeting at all. */
    hasAnyMeetings: boolean;
    /**
     * True when the list below is empty too. Two dashed empty states stacked
     * on one screen read as a broken page, so then the list speaks and this
     * stays out of the way.
     */
    listIsEmpty: boolean;
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
    hasAnyMeetings,
    listIsEmpty,
}: MeetingsUpcomingStripProps) {
    const { timezone } = useUserDateTime();
    const { td } = useTd();

    // Still loading (the cards are a deferred prop): hold their place rather
    // than render nothing and push the list down when they arrive.
    if (!meetings) return <StripSkeleton />;

    const handlers = (meeting: DealFollowup) => ({
        permissions,
        userId,
        onView: () => onView(meeting),
        onEdit: () => onEdit(meeting),
        onDelete: () => onDelete(meeting),
        onReport: () => onReport(meeting),
    });

    if (meetings.length === 0) {
        // The list below is empty as well and has the full empty state: one
        // per screen.
        if (listIsEmpty) return null;

        // The list has rows (Past, or All), so the one thing it cannot say is
        // that nothing is coming. One quiet line says it; the full dashed
        // card is for a screen with nothing else on it.
        return (
            <section className="mb-5" aria-label={td("Next meetings")}>
                <StripHeading label={td("Next up")} />
                <div
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
                    style={{
                        background: T.SURFACE_2,
                        border: `1px solid ${T.BORDER}`,
                    }}
                >
                    <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {hasAnyMeetings
                            ? td("Nothing else is scheduled.")
                            : td("You have not booked a meeting yet.")}
                    </span>
                    {canSchedule && (
                        <Button variant="ghost" size="sm" onClick={onSchedule}>
                            {td("Schedule a meeting")}
                        </Button>
                    )}
                </div>
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

/** The cards' place while they load — same grid, so nothing shifts on arrival. */
function StripSkeleton() {
    const { td } = useTd();

    return (
        <section
            className="mb-5"
            aria-busy="true"
            aria-label={td("Next meetings")}
        >
            <StripHeading label={td("Next up")} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((index) => (
                    <div
                        key={index}
                        className={`h-[132px] animate-pulse rounded-[10px] bg-dr-skeleton ${
                            index === 1
                                ? "hidden md:block"
                                : index === 2
                                  ? "hidden xl:block"
                                  : ""
                        }`}
                    />
                ))}
            </div>
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
