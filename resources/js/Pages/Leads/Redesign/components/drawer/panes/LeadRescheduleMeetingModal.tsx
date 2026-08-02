import { useMemo } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import RescheduleMeetingModal, {
    type RescheduleMeetingSubmitPayload,
} from "@/Components/Redesign/modals/RescheduleMeetingModal";
import { buildRescheduleFormFromFollowup } from "@/Components/Redesign/meeting/meetingFormUtils";
import useLeadMeetingReschedule from "../../../hooks/useLeadMeetingReschedule";

interface LeadRescheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    followup: DealFollowup | null;
}

export default function LeadRescheduleMeetingModal({
    open,
    onClose,
    followup,
}: LeadRescheduleMeetingModalProps) {
    const { td } = useTd();
    const { rescheduleMeeting, isRescheduling, errors, clearErrors } =
        useLeadMeetingReschedule(followup?.id ?? null);

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
                title: td("Reschedule meeting"),
                cancel: td("Cancel"),
                submit: td("Reschedule"),
                newDate: td("New date"),
                newStartTime: td("New start time"),
                duration: td("Duration"),
                hideDuration: td("Hide duration"),
                addDuration: td("Add duration"),
                endTime: td("End time"),
            }}
        />
    );
}
