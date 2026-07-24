import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useDealMeetingReschedule from "../../hooks/useDealMeetingReschedule";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import {
    MEETING_DURATION_OPTIONS,
    addMinutesToTime,
    buildRescheduleFormFromFollowup,
    diffMinutesBetweenTimes,
} from "./meetingFormUtils";

interface DealRescheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    followup: DealFollowup | null;
}

interface RescheduleFormState {
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
}

export default function DealRescheduleMeetingModal({
    open,
    onClose,
    followup,
}: DealRescheduleMeetingModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [form, setForm] = useState<RescheduleFormState | null>(null);
    const [showDuration, setShowDuration] = useState(false);
    const { rescheduleMeeting, isRescheduling, errors, clearErrors } =
        useDealMeetingReschedule(followup?.id ?? null);

    useEffect(() => {
        if (open && followup) {
            const initial = buildRescheduleFormFromFollowup(followup);
            setForm(initial);
            setShowDuration(Boolean(initial.duration));
            clearErrors();
        }
    }, [clearErrors, followup, open]);

    const handleClose = () => {
        if (isRescheduling) return;
        onClose();
    };

    const handleDurationSelect = (duration: number) => {
        if (!form) return;
        const nextDuration = form.duration === duration ? null : duration;
        setForm({
            ...form,
            duration: nextDuration,
            endTime:
                nextDuration && form.startTime
                    ? addMinutesToTime(form.startTime, nextDuration)
                    : form.endTime,
        });
    };

    const handleSubmit = () => {
        if (!form) return;
        rescheduleMeeting(
            {
                date: form.date,
                startTime: form.startTime,
                duration: form.duration,
            },
            handleClose,
        );
    };

    if (!form) return null;

    return (
        <DealModal
            open={open}
            title={t("pages.deals.workspace.meetings.reschedule_meeting")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isRescheduling}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isRescheduling}
                        disabled={isRescheduling}
                    >
                        {t("pages.deals.workspace.meetings.reschedule")}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={t("pages.deals.workspace.meetings.new_date")}>
                    <input
                        type="date"
                        value={form.date}
                        min={new Date().toISOString().split("T")[0]}
                        disabled={isRescheduling}
                        onChange={(event) =>
                            setForm({ ...form, date: event.target.value })
                        }
                    />
                </DealModalField>

                <DealModalField label={t("pages.deals.workspace.meetings.new_start_time")}>
                    <input
                        type="time"
                        value={form.startTime}
                        disabled={isRescheduling}
                        onChange={(event) => {
                            const startTime = event.target.value;
                            setForm({
                                ...form,
                                startTime,
                                endTime:
                                    form.duration && startTime
                                        ? addMinutesToTime(
                                              startTime,
                                              form.duration,
                                          )
                                        : form.endTime,
                            });
                        }}
                    />
                </DealModalField>
            </div>

            <DealModalField label={t("pages.deals.workspace.meetings.duration")}>
                <button
                    type="button"
                    onClick={() => setShowDuration((current) => !current)}
                    className="mb-2 border-none bg-transparent p-0 text-[12px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                >
                    {showDuration
                        ? t("pages.deals.workspace.meetings.hide_duration")
                        : `+ ${t("pages.deals.workspace.meetings.add_duration")}`}
                </button>
                {showDuration && (
                    <div className="flex flex-wrap gap-1.5">
                        {MEETING_DURATION_OPTIONS.map((option) => {
                            const active = form.duration === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={isRescheduling}
                                    onClick={() =>
                                        handleDurationSelect(option.value)
                                    }
                                    className="rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
                                    style={{
                                        borderColor: active
                                            ? T.NAVY
                                            : T.BORDER,
                                        background: active ? T.NAVY : T.WHITE,
                                        color: active
                                            ? T.WHITE
                                            : T.TEXT_MUTED,
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </DealModalField>

            <DealModalField label={t("pages.deals.workspace.meetings.end_time")}>
                <input
                    type="time"
                    value={form.endTime}
                    disabled={isRescheduling}
                    onChange={(event) => {
                        const endTime = event.target.value;
                        const duration = diffMinutesBetweenTimes(
                            form.startTime,
                            endTime,
                        );
                        setForm({ ...form, endTime, duration });
                    }}
                />
            </DealModalField>
        </DealModal>
    );
}
