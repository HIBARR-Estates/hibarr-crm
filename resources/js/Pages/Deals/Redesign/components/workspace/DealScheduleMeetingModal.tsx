import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import useDealMeetingCreate from "../../hooks/useDealMeetingCreate";
import DealButton from "../primitives/DealButton";
import { DealModal } from "../primitives/DealModal";
import {
    MeetingFormState,
    buildEmptyMeetingForm,
} from "./meetingFormUtils";
import DealMeetingFormFields from "./meeting/DealMeetingFormFields";

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
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<MeetingFormState>(() =>
        buildEmptyMeetingForm(deal, currentUserId),
    );
    const { createMeeting, isCreating, errors, clearErrors } =
        useDealMeetingCreate(deal);

    useEffect(() => {
        if (!open) {
            setForm(buildEmptyMeetingForm(deal, currentUserId));
            clearErrors();
        }
    }, [clearErrors, currentUserId, deal, open]);

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
            },
            handleClose,
        );
    };

    return (
        <DealModal
            open={open}
            title={t("pages.deals.workspace.meetings.schedule")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isCreating}
                        disabled={isCreating}
                    >
                        {t("pages.deals.workspace.meetings.schedule_button")}
                    </DealButton>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error)}
                        </p>
                    ))}
                </div>
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
