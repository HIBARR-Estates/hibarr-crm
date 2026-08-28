import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import { buildEmptyMeetingForm, getMeetingOwner } from "./meetingFormUtils";
import useDealMeetingCreate from "../../hooks/useDealMeetingCreate";

interface DealScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

export default function DealScheduleMeetingModal({
    open,
    onClose,
    deal,
    meetingTypes,
}: DealScheduleMeetingModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const currentUserEmail = props.auth?.user?.email;
    const initialForm = useMemo(
        () => buildEmptyMeetingForm(deal, currentUserId, currentUserEmail),
        [deal, currentUserId, currentUserEmail],
    );
    const mustIncludeOwner = useMemo(() => getMeetingOwner(deal), [deal]);
    const { createMeeting, isCreating, errors, clearErrors } =
        useDealMeetingCreate(deal);

    const handleClose = () => {
        if (isCreating) return;
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: MeetingFormState) => {
        createMeeting(
            {
                meetingTypeId: form.meetingTypeId,
                date: form.date,
                startTime: form.startTime,
                endTime: form.endTime,
                duration: form.duration,
                platform: form.platform,
                locationDetail: form.locationDetail,
                meetingLink: form.meetingLink,
                participants: form.participants,
                hostId: form.hostId,
                remark: form.remark,
                reminders: form.reminders,
            },
            handleClose,
        );
    };

    return (
        <ScheduleMeetingModal
            open={open}
            onClose={handleClose}
            saving={isCreating}
            errors={errors}
            meetingTypes={meetingTypes}
            initialForm={initialForm}
            onSubmit={handleSubmit}
            mustIncludeOwner={mustIncludeOwner}
            labels={{
                title: t("pages.deals.workspace.meetings.schedule"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.workspace.meetings.schedule_button"),
            }}
        />
    );
}
