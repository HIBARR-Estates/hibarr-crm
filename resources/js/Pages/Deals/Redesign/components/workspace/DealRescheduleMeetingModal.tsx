import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import RescheduleMeetingModal, {
    type RescheduleMeetingSubmitPayload,
} from "@/Components/Redesign/modals/RescheduleMeetingModal";
import { buildRescheduleFormFromFollowup } from "./meetingFormUtils";
import useDealMeetingReschedule from "../../hooks/useDealMeetingReschedule";

interface DealRescheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    followup: DealFollowup | null;
}

export default function DealRescheduleMeetingModal({
    open,
    onClose,
    followup,
}: DealRescheduleMeetingModalProps) {
    const { t } = useTranslation();
    const { rescheduleMeeting, isRescheduling, errors, clearErrors } =
        useDealMeetingReschedule(followup?.id ?? null);

    const initialForm = useMemo(() => {
        if (!open || !followup) return null;
        return buildRescheduleFormFromFollowup(followup);
    }, [open, followup]);

    const handleClose = () => {
        if (isRescheduling) return;
        clearErrors();
        onClose();
    };

    const handleSubmit = (payload: RescheduleMeetingSubmitPayload) => {
        rescheduleMeeting(payload, handleClose);
    };

    return (
        <RescheduleMeetingModal
            open={open}
            onClose={handleClose}
            saving={isRescheduling}
            errors={errors}
            initialForm={initialForm}
            onSubmit={handleSubmit}
            labels={{
                title: t("pages.deals.workspace.meetings.reschedule_meeting"),
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
                addDuration: t("pages.deals.workspace.meetings.add_duration"),
                endTime: t("pages.deals.workspace.meetings.end_time"),
            }}
        />
    );
}
