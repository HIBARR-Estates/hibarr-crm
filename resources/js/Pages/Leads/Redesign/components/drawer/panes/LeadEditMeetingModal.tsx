import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Lead } from "@/Types/api/leads";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadMeetingCreateInput } from "../../../hooks/useLeadMeetingCreate";
import useLeadMeetingUpdate from "../../../hooks/useLeadMeetingUpdate";
import EditMeetingModal from "@/Components/Redesign/modals/EditMeetingModal";
import {
    buildMeetingFormFromFollowup,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";

interface LeadEditMeetingModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    followup: DealFollowup | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

function toSubmitInput(
    form: MeetingFormState,
    dealId: number | null,
): LeadMeetingCreateInput & { dealId?: number | null } {
    return {
        meetingTypeId: form.meetingTypeId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        duration: form.duration,
        platform: form.platform,
        meetingLink: form.meetingLink,
        participants: form.participants,
        remark: form.remark,
        reminders: form.reminders,
        dealId,
    };
}

export default function LeadEditMeetingModal({
    open,
    onClose,
    lead,
    followup,
    meetingTypes,
}: LeadEditMeetingModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const { updateMeeting, isUpdating, errors, clearErrors } =
        useLeadMeetingUpdate(lead);

    const dealId =
        followup?.deal_id ??
        (followup?.deal as { id?: number } | undefined)?.id ??
        null;

    const initialForm = useMemo(() => {
        if (!open || !followup) return null;
        return buildMeetingFormFromFollowup(followup, null, currentUserId);
    }, [open, followup, currentUserId]);

    const handleClose = () => {
        if (isUpdating) return;
        setLocalErrors([]);
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: MeetingFormState) => {
        if (!followup) return;

        const validationErrors: string[] = [];
        if (!dealId) {
            validationErrors.push(
                "This meeting must be linked to a deal before it can be edited.",
            );
        }
        if (!form.meetingTypeId) {
            validationErrors.push("Please select a meeting type.");
        }
        if (!form.date) validationErrors.push("Please select a meeting date.");
        if (!form.startTime) {
            validationErrors.push("Please select a start time.");
        }
        if (form.platform === "zoho" && form.participants.length === 0) {
            validationErrors.push(
                "At least one participant is required for video meetings.",
            );
        }

        if (validationErrors.length > 0) {
            setLocalErrors(validationErrors);
            return;
        }

        setLocalErrors([]);
        updateMeeting(followup.id, toSubmitInput(form, dealId), handleClose);
    };

    return (
        <EditMeetingModal
            open={open}
            onClose={handleClose}
            saving={isUpdating}
            errors={[...localErrors, ...errors]}
            meetingTypes={meetingTypes}
            initialForm={initialForm}
            onSubmit={handleSubmit}
            showExistingMeetingLinkHint={Boolean(initialForm?.meetingLink)}
            labels={{
                title: td("Edit meeting"),
                cancel: td("Cancel"),
                submit: td("Save changes"),
            }}
        />
    );
}
