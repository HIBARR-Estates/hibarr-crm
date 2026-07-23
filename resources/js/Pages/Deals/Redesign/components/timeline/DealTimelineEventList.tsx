import { useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { TimelineEventViewModel } from "../../adapters/timelineAdapter";
import useDealTimelineEventMutations, {
    TimelineEventUpdateInput,
} from "../../hooks/useDealTimelineEventMutations";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealTimelineEventRow from "./DealTimelineEventRow";
import DealTimelineEventEditModal from "./DealTimelineEventEditModal";

interface DealTimelineEventListProps {
    events: TimelineEventViewModel[];
    isLoading: boolean;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    onLoadMore: () => void;
    /** Whether the current user may edit/delete agent-logged events (admin). */
    canManage?: boolean;
    /** Called after a successful edit/delete to refresh the list. */
    onChanged?: () => void;
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
    canManage = false,
    onChanged,
}: DealTimelineEventListProps) {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] =
        useState<TimelineEventViewModel | null>(null);
    const [deletingEvent, setDeletingEvent] =
        useState<TimelineEventViewModel | null>(null);

    const { updateEvent, deleteEvent, savingUuid, deletingUuid } =
        useDealTimelineEventMutations(() => onChanged?.());

    if (isLoading) {
        return <TimelineSkeleton />;
    }

    if (events.length === 0) {
        return (
            <div style={{ fontSize: 12, color: T.TEXT_HINT, padding: "8px 0" }}>
                {t("pages.deals.timeline.empty")}
            </div>
        );
    }

    const handleEditSubmit = (input: TimelineEventUpdateInput) => {
        if (!editingEvent) return;
        updateEvent(editingEvent.id, input, () => setEditingEvent(null));
    };

    const handleDeleteConfirm = () => {
        if (!deletingEvent) return;
        deleteEvent(deletingEvent.id, () => setDeletingEvent(null));
    };

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
                    canManage={canManage}
                    onEdit={setEditingEvent}
                    onDelete={setDeletingEvent}
                />
            ))}

            {hasNextPage && (
                <div className="pt-1">
                    <DealButton
                        variant="ghost"
                        onClick={onLoadMore}
                        loading={isFetchingNextPage}
                    >
                        {t("pages.deals.timeline.load_more")}
                    </DealButton>
                </div>
            )}

            <DealTimelineEventEditModal
                event={editingEvent}
                open={editingEvent !== null}
                saving={savingUuid !== null}
                onClose={() => setEditingEvent(null)}
                onSubmit={handleEditSubmit}
            />

            <DealConfirmDialog
                open={deletingEvent !== null}
                title={t("pages.deals.timeline.delete_confirm_title")}
                message={t("pages.deals.timeline.delete_confirm_message")}
                confirmLabel={t("pages.deals.timeline.delete_event")}
                cancelLabel={t("pages.deals.common.cancel")}
                danger
                confirmLoading={deletingUuid !== null}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeletingEvent(null)}
            />
        </>
    );
}
