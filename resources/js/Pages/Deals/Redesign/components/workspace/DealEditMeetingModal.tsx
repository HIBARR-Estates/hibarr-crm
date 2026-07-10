import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useDealMeetingUpdate from "../../hooks/useDealMeetingUpdate";
import type { DealMeetingCreateInput } from "../../hooks/useDealMeetingCreate";
import DealButton from "../primitives/DealButton";
import { DealModal } from "../primitives/DealModal";
import {
    MeetingFormState,
    buildMeetingFormFromFollowup,
} from "./meetingFormUtils";
import DealMeetingFormFields from "./meeting/DealMeetingFormFields";

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
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<MeetingFormState | null>(null);
    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const { updateMeeting, isUpdating, errors, clearErrors } =
        useDealMeetingUpdate(deal);

    useEffect(() => {
        if (open && followup) {
            setForm(buildMeetingFormFromFollowup(followup, deal, currentUserId));
            setLocalErrors([]);
            clearErrors();
        }
    }, [clearErrors, currentUserId, deal, followup, open]);

    const handleClose = () => {
        if (isUpdating) return;
        onClose();
    };

    const handleSubmit = () => {
        if (!form || !followup) return;

        const validationErrors: string[] = [];
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
        updateMeeting(followup.id, toSubmitInput(form), handleClose);
    };

    if (!form) return null;

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
