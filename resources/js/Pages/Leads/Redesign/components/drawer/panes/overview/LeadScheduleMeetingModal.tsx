import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Lead } from "@/Types/api/leads";
import type { MeetingFormState } from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";
import DealMeetingFormFields from "@/Pages/Deals/Redesign/components/workspace/meeting/DealMeetingFormFields";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import {
    DealModal,
    DealModalField,
} from "@/Pages/Deals/Redesign/components/primitives/DealModal";
import useLeadMeetingCreate from "../../../../hooks/useLeadMeetingCreate";

interface LeadScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    deals?: Array<{ id: number; name: string }>;
}

function buildEmptyLeadMeetingForm(
    currentUserId?: number,
): MeetingFormState {
    return {
        meetingTypeId: null,
        date: "",
        startTime: "",
        endTime: "",
        duration: null,
        platform: "zoho",
        meetingLink: "",
        participants: currentUserId ? [currentUserId] : [],
        remark: "",
        reminders: [],
    };
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
    const [form, setForm] = useState<MeetingFormState>(() =>
        buildEmptyLeadMeetingForm(currentUserId),
    );
    const [dealId, setDealId] = useState<number | null>(null);
    const { createMeeting, isCreating, errors, clearErrors } =
        useLeadMeetingCreate(lead);

    useEffect(() => {
        if (!open) {
            setForm(buildEmptyLeadMeetingForm(currentUserId));
            setDealId(null);
            clearErrors();
        }
    }, [clearErrors, currentUserId, open]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    const handleSubmit = () => {
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
        <DealModal
            open={open}
            title={td("Schedule meeting")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        {td("Cancel")}
                    </DealButton>
                    <DealButton
                        variant="navy"
                        onClick={handleSubmit}
                        loading={isCreating}
                        disabled={isCreating}
                    >
                        {td("Schedule")}
                    </DealButton>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            {deals.length > 0 && (
                <DealModalField label={td("Link deal (optional)")}>
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
                </DealModalField>
            )}

            <DealMeetingFormFields
                form={form}
                onChange={(patch) =>
                    setForm((current) => ({ ...current, ...patch }))
                }
                meetingTypes={meetingTypes}
                disabled={isCreating}
            />
        </DealModal>
    );
}
