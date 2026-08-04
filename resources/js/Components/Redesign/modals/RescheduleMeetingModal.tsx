import { useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    MEETING_DURATION_OPTIONS,
    addMinutesToTime,
    diffMinutesBetweenTimes,
} from "@/Components/Redesign/meeting/meetingFormUtils";

export interface RescheduleFormState {
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
}

export interface RescheduleMeetingModalLabels {
    title: string;
    cancel: string;
    submit: string;
    newDate: string;
    newStartTime: string;
    duration: string;
    hideDuration: string;
    addDuration: string;
    endTime: string;
}

export interface RescheduleMeetingSubmitPayload {
    date: string;
    startTime: string;
    duration: number | null;
}

interface RescheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    initialForm: RescheduleFormState | null;
    onSubmit: (payload: RescheduleMeetingSubmitPayload) => void;
    labels: RescheduleMeetingModalLabels;
}

export default function RescheduleMeetingModal({
    open,
    onClose,
    saving,
    errors,
    initialForm,
    onSubmit,
    labels,
}: RescheduleMeetingModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<RescheduleFormState | null>(null);
    const [showDuration, setShowDuration] = useState(false);
    const seededForOpenRef = useRef(false);

    // Seed once per open session — not when parent re-renders with a fresh
    // initialForm object (e.g. after validation sets errors).
    useEffect(() => {
        if (!open) {
            seededForOpenRef.current = false;
            setForm(null);
            return;
        }
        if (initialForm && !seededForOpenRef.current) {
            setForm(initialForm);
            setShowDuration(Boolean(initialForm.duration));
            seededForOpenRef.current = true;
        }
    }, [open, initialForm]);

    const handleClose = () => {
        if (saving) return;
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

    if (!form) return null;

    return (
        <Modal
            open={open}
            title={labels.title}
            onClose={handleClose}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() =>
                            onSubmit({
                                date: form.date,
                                startTime: form.startTime,
                                duration: form.duration,
                            })
                        }
                        loading={saving}
                        disabled={saving}
                    >
                        {labels.submit}
                    </Button>
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
                <ModalField label={labels.newDate}>
                    <input
                        type="date"
                        value={form.date}
                        min={new Date().toISOString().split("T")[0]}
                        disabled={saving}
                        onChange={(event) =>
                            setForm({ ...form, date: event.target.value })
                        }
                    />
                </ModalField>

                <ModalField label={labels.newStartTime}>
                    <input
                        type="time"
                        value={form.startTime}
                        disabled={saving}
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
                </ModalField>
            </div>

            <ModalField label={labels.duration}>
                <button
                    type="button"
                    onClick={() => setShowDuration((current) => !current)}
                    className="mb-2 border-none bg-transparent p-0 text-[12px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                >
                    {showDuration
                        ? labels.hideDuration
                        : `+ ${labels.addDuration}`}
                </button>
                {showDuration && (
                    <div className="flex flex-wrap gap-1.5">
                        {MEETING_DURATION_OPTIONS.map((option) => {
                            const active = form.duration === option.value;

                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={saving}
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
            </ModalField>

            <ModalField label={labels.endTime}>
                <input
                    type="time"
                    value={form.endTime}
                    disabled={saving}
                    onChange={(event) => {
                        const endTime = event.target.value;
                        const duration = diffMinutesBetweenTimes(
                            form.startTime,
                            endTime,
                        );
                        setForm({ ...form, endTime, duration });
                    }}
                />
            </ModalField>
        </Modal>
    );
}
