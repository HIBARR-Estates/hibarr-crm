import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    hasMeetingPermission,
    meetingBucket,
    meetingSummaryState,
} from "../adapters/meetingViewModel";
import MeetingSummaryPanel from "./MeetingSummaryPanel";
import MeetingDetailCompact from "./MeetingDetailCompact";
import { useState } from "react";

/** Which of the meeting's dialogs this one is showing. */
export type MeetingDetailAction = "view" | "delete";

interface MeetingsDetailDialogProps {
    meeting: DealFollowup | null;
    /** True while the record is being fetched by id (calendar chips). */
    loading?: boolean;
    action: MeetingDetailAction;
    permissions: Record<string, string>;
    userId?: number;
    onClose: () => void;
    /** Re-reads the list after a delete lands. */
    onChanged: () => void;
    /** Hands editing to the page's own edit form. */
    onEdit: (meeting: DealFollowup) => void;
}

/**
 * The Meetings index' detail dialog: `MeetingDetailCompact` with the AI
 * summary as a second tab, so "Summary" and "Meeting info" are two views of
 * one dialog rather than a modal stacked on a modal.
 *
 * This used to also offer the original stacked-panels layout
 * (`MeetingDetailModal`, shared with the deal/lead pages) behind a "Switch
 * layout" toggle so the two could be compared on the same meeting. That
 * comparison is settled now — this compact layout won — so the switch and
 * the other option are gone; `MeetingDetailModal` itself stays, since the
 * deal and lead pages still use it directly for their own meeting rows.
 *
 * Editing is a sibling dialog owned by the page (`MeetingsEditDialog`), so
 * the same form opens whether it was reached from a row's menu or from here.
 * Cancelling and rescheduling are left out on purpose: both post the whole
 * meeting back through the deal's update endpoint, and this page carries only
 * a trimmed deal.
 */
export default function MeetingsDetailDialog({
    meeting,
    loading = false,
    action,
    permissions,
    userId,
    onClose,
    onChanged,
    onEdit,
}: MeetingsDetailDialogProps) {
    const { timezone } = useUserDateTime();
    const { td } = useTd();
    const [deleting, setDeleting] = useState(false);

    // Opening a calendar chip fetches the meeting by id. Rendering nothing
    // until it lands makes the click feel broken — the dialog is what
    // acknowledges it, so it opens first and fills in after.
    if (!meeting) {
        return loading ? (
            <MeetingDetailSkeleton label={td("Loading meeting…")} />
        ) : null;
    }

    const canEdit = hasMeetingPermission(
        permissions.edit_lead_follow_up,
        meeting,
        userId,
    );
    const canDelete = hasMeetingPermission(
        permissions.delete_lead_follow_up,
        meeting,
        userId,
    );

    if (action === "delete") {
        return (
            <DeleteFollowup
                open
                onClose={onClose}
                followup={meeting}
                skipReload
                onDeleted={() => {
                    onClose();
                    onChanged();
                }}
            />
        );
    }

    const summaryState = meetingSummaryState(
        meeting,
        meetingBucket(meeting, timezone),
    );

    const summary = (
        <MeetingSummaryPanel meeting={meeting} state={summaryState} />
    );

    return (
        <>
            <MeetingDetailCompact
                key={meeting.id}
                meeting={meeting}
                canEdit={canEdit}
                canDelete={canDelete}
                userId={userId}
                onClose={onClose}
                onEdit={() => onEdit(meeting)}
                onDelete={() => setDeleting(true)}
                summaryPanel={summary}
            />
            {deleting && (
                <DeleteFollowup
                    open
                    onClose={() => setDeleting(false)}
                    followup={meeting}
                    skipReload
                    onDeleted={() => {
                        setDeleting(false);
                        onClose();
                        onChanged();
                    }}
                />
            )}
        </>
    );
}

/**
 * The dialog's shape while the record is still in flight — the same frame the
 * loaded dialog uses, so nothing jumps when the content arrives.
 */
function MeetingDetailSkeleton({ label }: { label: string }) {
    return (
        <Modal open title={label} onClose={() => undefined}>
            <div className="space-y-3" aria-hidden>
                {[64, 40, 40, 96].map((height, index) => (
                    <div
                        key={index}
                        className="animate-pulse rounded-lg"
                        style={{ height, background: T.SKELETON }}
                    />
                ))}
            </div>
        </Modal>
    );
}
