import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TimelineEventViewModel } from "../../adapters/timelineAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealButton from "../primitives/DealButton";
import DealTimelineEventRow from "./DealTimelineEventRow";

interface DealTimelineEventListProps {
    events: TimelineEventViewModel[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
}

function TimelineSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#e2e5ea]" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-[#eef1f5]" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-[#eef1f5]" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function DealTimelineEventList({
    events,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
}: DealTimelineEventListProps) {
    const { td } = useTd();
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (isLoading) {
        return <TimelineSkeleton />;
    }

    if (events.length === 0) {
        return (
            <div style={{ fontSize: 12, color: T.TEXT_HINT, padding: "8px 0" }}>
                {td("No events yet")}
            </div>
        );
    }

    return (
        <>
            {events.map((event) => (
                <DealTimelineEventRow
                    key={event.id}
                    event={event}
                    expanded={expandedId === event.id}
                    onToggleExpand={() =>
                        setExpandedId((current) =>
                            current === event.id ? null : event.id,
                        )
                    }
                />
            ))}

            {hasNextPage && (
                <div className="pt-1">
                    <DealButton
                        variant="ghost"
                        onClick={onLoadMore}
                        loading={isFetchingNextPage}
                    >
                        {td("Load more")}
                    </DealButton>
                </div>
            )}
        </>
    );
}
