import { useUserDateTime } from "@/Hooks/useUserDateTime";
import MeetingDetailModal from "@/Components/Redesign/modals/MeetingDetailModal";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    hasMeetingPermission,
    meetingBucket,
    meetingSummaryState,
} from "../adapters/meetingViewModel";
import MeetingSummaryPanel from "./MeetingSummaryPanel";

/** Which of the meeting's dialogs this one is showing. */
export type MeetingDetailAction = "view" | "delete";

interface MeetingsDetailDialogProps {
    meeting: DealFollowup | null;
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
 * The Meetings index' detail dialog: the shared `MeetingDetailModal` with the
 * AI summary as a second tab, so "Summary" and "Meeting info" are two views
 * of one dialog rather than a modal stacked on a modal.
 *
 * Editing is a sibling dialog owned by the page (`MeetingsEditDialog`), so
 * the same form opens whether it was reached from a row's menu or from here.
 * Cancelling and rescheduling are left out on purpose: both post the whole
 * meeting back through the deal's update endpoint, and this page carries only
 * a trimmed deal.
 */
export default function MeetingsDetailDialog({
    meeting,
    action,
    permissions,
    userId,
    onClose,
    onChanged,
    onEdit,
}: MeetingsDetailDialogProps) {
    const { timezone } = useUserDateTime();

    if (!meeting) return null;

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

    return (
        <MeetingDetailModal
            // Re-mounted per meeting so the dialog always opens on the info
            // tab rather than on whichever tab the last meeting was left on.
            key={meeting.id}
            meeting={meeting}
            canEdit={canEdit}
            canDelete={canDelete}
            canReschedule={false}
            canCancel={false}
            onClose={onClose}
            isUpdating={false}
            // Cancel never renders here; the prop is required and closing is
            // the honest no-op.
            onCancelMeeting={onClose}
            onEditRequested={() => onEdit(meeting)}
            summaryPanel={
                <MeetingSummaryPanel meeting={meeting} state={summaryState} />
            }
            renderNestedModals={({ deleteOpen, setDeleteOpen }) =>
                deleteOpen ? (
                    <DeleteFollowup
                        open
                        onClose={() => setDeleteOpen(false)}
                        followup={meeting}
                        skipReload
                        onDeleted={() => {
                            setDeleteOpen(false);
                            onClose();
                            onChanged();
                        }}
                    />
                ) : null
            }
        />
    );
}
