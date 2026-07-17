import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Lead } from "@/Types/api/leads";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { LeadMeetingCreateInput } from "../../../hooks/useLeadMeetingCreate";
import useLeadMeetingUpdate from "../../../hooks/useLeadMeetingUpdate";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import { DealModal } from "@/Pages/Deals/Redesign/components/primitives/DealModal";
import DealMeetingFormFields from "@/Pages/Deals/Redesign/components/workspace/meeting/DealMeetingFormFields";
import {
    MeetingFormState,
    MeetingPlatform,
    addMinutesToTime,
} from "@/Pages/Deals/Redesign/components/workspace/meetingFormUtils";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

interface LeadEditMeetingModalProps {
    open: boolean;
    onClose: () => void;
    lead: Lead;
    followup: DealFollowup | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

function buildLeadMeetingFormFromFollowup(
    followup: DealFollowup,
    currentUserId?: number,
): MeetingFormState {
    const localDate = dayjs.utc(followup.next_follow_up_date).local();
    const duration = followup.duration ?? followup.effective_duration ?? 30;
    const startTime = localDate.format("HH:mm");
    const customReminders =
        followup.reminders?.filter((reminder) => !reminder.is_default) ?? [];
    const participants =
        followup.participants?.length && followup.participants.length > 0
            ? followup.participants
            : currentUserId
              ? [currentUserId]
              : [];

    return {
        meetingTypeId: followup.meeting_type?.id ?? null,
        date: localDate.format("YYYY-MM-DD"),
        startTime,
        endTime: addMinutesToTime(startTime, duration),
        duration,
        platform: (followup.location || "zoho") as MeetingPlatform,
        meetingLink: followup.meeting_link || "",
        participants,
        remark: followup.remark || "",
        reminders: customReminders,
    };
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
    const [form, setForm] = useState<MeetingFormState | null>(null);
    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const { updateMeeting, isUpdating, errors, clearErrors } =
        useLeadMeetingUpdate(lead);

    const dealId =
        followup?.deal_id ??
        (followup?.deal as { id?: number } | undefined)?.id ??
        null;

    useEffect(() => {
        if (open && followup) {
            setForm(buildLeadMeetingFormFromFollowup(followup, currentUserId));
            setLocalErrors([]);
            clearErrors();
        }

        if (!open) {
            setForm(null);
            setLocalErrors([]);
            clearErrors();
        }
    }, [clearErrors, currentUserId, followup, open]);

    const handleClose = () => {
        if (isUpdating) return;
        onClose();
    };

    const handleSubmit = () => {
        if (!form || !followup) return;

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

    if (!open || !form) return null;

    const displayErrors = [...localErrors, ...errors];

    return (
        <DealModal
            open={open}
            title={td("Edit meeting")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isUpdating}
                    >
                        {td("Cancel")}
                    </DealButton>
                    <DealButton
                        variant="navy"
                        onClick={handleSubmit}
                        loading={isUpdating}
                        disabled={isUpdating}
                    >
                        {td("Save changes")}
                    </DealButton>
                </>
            }
        >
            {displayErrors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {displayErrors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            <DealMeetingFormFields
                form={form}
                onChange={(patch) =>
                    setForm((current) =>
                        current ? { ...current, ...patch } : current,
                    )
                }
                meetingTypes={meetingTypes}
                disabled={isUpdating}
                meetingLinkReadOnly
                showExistingMeetingLinkHint={Boolean(form.meetingLink)}
            />
        </DealModal>
    );
}
