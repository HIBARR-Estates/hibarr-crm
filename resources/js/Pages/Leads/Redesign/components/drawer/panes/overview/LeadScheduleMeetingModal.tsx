import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Lead } from "@/Types/api/leads";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import {
    buildEmptyMeetingForm,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import useLeadMeetingCreate from "../../../../hooks/useLeadMeetingCreate";

interface LeadScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    deals?: Array<{ id: number; name: string }>;
}

export default function LeadScheduleMeetingModal({
    open,
    onClose,
    lead,
    meetingTypes,
    deals = [],
}: LeadScheduleMeetingModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [dealId, setDealId] = useState<number | null>(null);
    const { createMeeting, isCreating, errors, clearErrors } =
        useLeadMeetingCreate(lead);

    const initialForm = useMemo(
        () => buildEmptyMeetingForm(null, currentUserId),
        [currentUserId],
    );

    const handleClose = () => {
        if (isCreating) return;
        setDealId(null);
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
                meetingLink: form.meetingLink,
                participants: form.participants,
                remark: form.remark,
                reminders: form.reminders,
                dealId,
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
            labels={{
                title: td("Schedule meeting"),
                cancel: td("Cancel"),
                submit: td("Schedule"),
            }}
            extraFields={
                deals.length > 0 ? (
                    <ModalField label={td("Link deal (optional)")}>
                        <select
                            value={dealId ?? ""}
                            disabled={isCreating}
                            onChange={(event) =>
                                setDealId(
                                    event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                )
                            }
                        >
                            <option value="">{td("No deal")}</option>
                            {deals.map((deal) => (
                                <option key={deal.id} value={deal.id}>
                                    {deal.name}
                                </option>
                            ))}
                        </select>
                    </ModalField>
                ) : null
            }
        />
    );
}
