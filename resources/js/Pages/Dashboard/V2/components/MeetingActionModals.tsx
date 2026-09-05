import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import MeetingDetailModal from "@/Components/Redesign/modals/MeetingDetailModal";
import RescheduleMeetingModal, {
    type RescheduleMeetingSubmitPayload,
} from "@/Components/Redesign/modals/RescheduleMeetingModal";
import { buildRescheduleFormFromFollowup } from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";
import useDashboardMeetingReschedule from "../hooks/useDashboardMeetingReschedule";

interface MeetingActionModalsProps {
    meeting: DealFollowup | null;
    onClose: () => void;
    onMarkHeld: (followUpId: number) => void;
    markingHeld?: boolean;
    /** Deferred props to re-resolve after a reschedule — the host page's. */
    reloadKeys: string[];
}

/**
 * The Today panel's meeting modal.
 *
 * Detail and reschedule only. Editing a meeting needs the meeting-type list and
 * the deal it belongs to; deleting one from a dashboard row has the same
 * problem as deleting a task. Both stay on the record page.
 */
export default function MeetingActionModals({
    meeting,
    onClose,
    onMarkHeld,
    markingHeld = false,
    reloadKeys,
}: MeetingActionModalsProps) {
    const { t } = useTranslation();
    const { rescheduleMeeting, isRescheduling, errors, clearErrors } =
        useDashboardMeetingReschedule(meeting?.id ?? null, reloadKeys);

    return (
        <MeetingDetailModal
            meeting={meeting}
            canEdit={false}
            canDelete={false}
            canReschedule
            onClose={onClose}
            isUpdating={isRescheduling || markingHeld}
            onMarkHeld={meeting ? () => onMarkHeld(meeting.id) : undefined}
            // Cancel is gated behind canEdit and so never renders here; the
            // prop is required, and closing is the honest no-op.
            onCancelMeeting={onClose}
            renderNestedModals={({ rescheduleOpen, setRescheduleOpen }) =>
                meeting ? (
                    <Reschedule
                        open={rescheduleOpen}
                        onClose={() => setRescheduleOpen(false)}
                        meeting={meeting}
                        saving={isRescheduling}
                        errors={errors}
                        clearErrors={clearErrors}
                        onSubmit={(payload, done) =>
                            rescheduleMeeting(payload, done)
                        }
                        labels={{
                            title: t(
                                "pages.deals.workspace.meetings.reschedule_meeting",
                            ),
                            cancel: t("pages.deals.common.cancel"),
                            submit: t("pages.deals.workspace.meetings.reschedule"),
                            newDate: t("pages.deals.workspace.meetings.new_date"),
                            newStartTime: t(
                                "pages.deals.workspace.meetings.new_start_time",
                            ),
                            duration: t("pages.deals.workspace.meetings.duration"),
                            hideDuration: t(
                                "pages.deals.workspace.meetings.hide_duration",
                            ),
                            addDuration: t(
                                "pages.deals.workspace.meetings.add_duration",
                            ),
                            endTime: t("pages.deals.workspace.meetings.end_time"),
                        }}
                    />
                ) : null
            }
        />
    );
}

function Reschedule({
    open,
    onClose,
    meeting,
    saving,
    errors,
    clearErrors,
    onSubmit,
    labels,
}: {
    open: boolean;
    onClose: () => void;
    meeting: DealFollowup;
    saving: boolean;
    errors: string[];
    clearErrors: () => void;
    onSubmit: (
        payload: RescheduleMeetingSubmitPayload,
        onDone: () => void,
    ) => void;
    labels: React.ComponentProps<typeof RescheduleMeetingModal>["labels"];
}) {
    const initialForm = useMemo(
        () => (open ? buildRescheduleFormFromFollowup(meeting) : null),
        [open, meeting],
    );

    const handleClose = () => {
        if (saving) return;
        clearErrors();
        onClose();
    };

    return (
        <RescheduleMeetingModal
            open={open}
            onClose={handleClose}
            saving={saving}
            errors={errors}
            initialForm={initialForm}
            onSubmit={(payload) => onSubmit(payload, handleClose)}
            labels={labels}
        />
    );
}
