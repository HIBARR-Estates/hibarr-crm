import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import EditMeetingModal from "@/Components/Redesign/modals/EditMeetingModal";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import {
    requiresManualMeetingLink,
    requiresMeetingParticipants,
    requiresPhysicalLocationDetail,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import { buildMeetingFormFromFollowup } from "./meetingFormUtils";
import useDealMeetingUpdate from "../../hooks/useDealMeetingUpdate";
import type { DealMeetingCreateInput } from "../../hooks/useDealMeetingCreate";

interface DealEditMeetingModalProps {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    followup: DealFollowup | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

function toSubmitInput(form: MeetingFormState): DealMeetingCreateInput {
    return {
        meetingTypeId: form.meetingTypeId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        duration: form.duration,
        platform: form.platform,
        locationDetail: form.locationDetail,
        meetingLink: form.meetingLink,
        participants: form.participants,
        remark: form.remark,
        reminders: form.reminders,
    };
}

export default function DealEditMeetingModal({
    open,
    onClose,
    deal,
    followup,
    meetingTypes,
}: DealEditMeetingModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const { updateMeeting, isUpdating, errors, clearErrors } =
        useDealMeetingUpdate(deal);

    const initialForm = useMemo(() => {
        if (!open || !followup) return null;
        return buildMeetingFormFromFollowup(followup, deal, currentUserId);
    }, [open, followup, deal, currentUserId]);

    const handleClose = () => {
        if (isUpdating) return;
        setLocalErrors([]);
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: MeetingFormState) => {
        if (!followup) return;

        const validationErrors: string[] = [];
        if (!form.meetingTypeId) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.select_meeting_type"),
            );
        }
        if (!form.date) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.select_date"),
            );
        }
        if (!form.startTime) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.select_start_time"),
            );
        }
        if (
            requiresMeetingParticipants(form.platform) &&
            form.participants.length === 0
        ) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.participants_required"),
            );
        }

        if (
            requiresManualMeetingLink(form.platform) &&
            !form.meetingLink.trim()
        ) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.paste_meeting_link"),
            );
        }

        if (
            requiresPhysicalLocationDetail(form.platform) &&
            !form.locationDetail.trim()
        ) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.enter_location"),
            );
        }

        if (validationErrors.length > 0) {
            setLocalErrors(validationErrors);
            return;
        }

        setLocalErrors([]);
        updateMeeting(followup.id, toSubmitInput(form), handleClose);
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
            labels={{
                title: t("pages.deals.workspace.meetings.edit_meeting"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.common.save_changes"),
            }}
        />
    );
}
