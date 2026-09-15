import type { DealFollowup } from "@/Types/api/deal-followup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import MeetingViewModal from "@/Components/Redesign/modals/MeetingViewModal";
import {
    hasMeetingPermission,
} from "../adapters/meetingViewModel";

/** Which of the meeting's dialogs this one is showing. */
export type MeetingDetailAction = "view" | "delete";

interface MeetingsDetailDialogProps {
    meeting: DealFollowup | null;
    /** True while the record is being fetched by id (calendar chips). */
    loading?: boolean;
    /** Set when that fetch failed — shown in place of the skeleton. */
    error?: string | null;
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
 * The Meetings index' detail dialog — the shared `MeetingViewModal`
 * (MeetingDetailCompact) with page-owned edit/delete wiring.
 *
 * Cancelling and rescheduling stay out on purpose: both post the whole meeting
 * back through the deal's update endpoint, and this page carries only a
 * trimmed deal.
 */
export default function MeetingsDetailDialog({
    meeting,
    loading = false,
    error,
    action,
    permissions,
    userId,
    onClose,
    onChanged,
    onEdit,
}: MeetingsDetailDialogProps) {
    const canEdit = meeting
        ? hasMeetingPermission(
              permissions.edit_lead_follow_up,
              meeting,
              userId,
          )
        : false;
    const canDelete = meeting
        ? hasMeetingPermission(
              permissions.delete_lead_follow_up,
              meeting,
              userId,
          )
        : false;

    if (action === "delete" && meeting) {
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

    return (
        <MeetingViewModal
            meeting={meeting}
            loading={loading}
            error={error}
            canEdit={canEdit}
            canDelete={canDelete}
            // Meetings index cannot cancel/reschedule — only a trimmed deal.
            canReschedule={false}
            canCancel={false}
            userId={userId}
            onClose={onClose}
            includeSummary
            onEditRequested={() => {
                if (meeting) onEdit(meeting);
            }}
            renderNestedModals={({ deleteOpen, setDeleteOpen }) =>
                deleteOpen && meeting ? (
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
            // This page only mounts when crm.meetings-page-redesign is on.
            fallback={null}
        />
    );
}
