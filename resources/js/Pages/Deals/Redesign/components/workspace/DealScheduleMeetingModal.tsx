import FormDataSelector from "@/Components/FormDataSelector";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import type { Reminder } from "@/Types/api/deal-followup";
import { usePage } from "@inertiajs/react";
import { useEffect, useMemo, useState } from "react";
import useDealMeetingCreate from "../../hooks/useDealMeetingCreate";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DealModal, DealModalField } from "../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import {
    MEETING_DURATION_OPTIONS,
    MEETING_PLATFORM_OPTIONS,
    MeetingPlatform,
    addMinutesToTime,
    diffMinutesBetweenTimes,
} from "./meetingFormUtils";

interface DealScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

interface MeetingFormState {
    meetingTypeId: number | null;
    date: string;
    startTime: string;
    endTime: string;
    duration: number | null;
    platform: MeetingPlatform;
    meetingLink: string;
    participants: number[];
    remark: string;
    reminders: Reminder[];
}

const DEFAULT_REMINDERS: Reminder[] = [
    { time: 1, type: "hour", is_default: true },
    { time: 30, type: "minute", is_default: true },
    { time: 15, type: "minute", is_default: true },
    { time: 5, type: "minute", is_default: true },
];

function getDefaultParticipants(
    deal: Deal,
    currentUserId?: number,
): number[] {
    const ids: number[] = [];

    if (currentUserId) {
        ids.push(currentUserId);
    }

    deal.deal_participants?.forEach((participant) => {
        if (participant.id && !ids.includes(participant.id)) {
            ids.push(participant.id);
        }
    });

    deal.deal_watchers?.forEach((watcher) => {
        if (watcher.id && !ids.includes(watcher.id)) {
            ids.push(watcher.id);
        }
    });

    return ids;
}

function buildInitialForm(
    deal: Deal,
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
        participants: getDefaultParticipants(deal, currentUserId),
        remark: "",
        reminders: [],
    };
}

function formatDefaultRemindersLabel(reminders: Reminder[]): string {
    return reminders
        .map((reminder) => {
            const unit =
                reminder.type === "hour"
                    ? reminder.time === 1
                        ? "hour"
                        : "hours"
                    : reminder.type === "minute"
                      ? reminder.time === 1
                          ? "minute"
                          : "minutes"
                      : reminder.type === "day"
                        ? reminder.time === 1
                            ? "day"
                            : "days"
                        : reminder.type;

            return `${reminder.time} ${unit}`;
        })
        .join(", ");
}

export default function DealScheduleMeetingModal({
    open,
    onClose,
    deal,
    meetingTypes,
}: DealScheduleMeetingModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [form, setForm] = useState<MeetingFormState>(() =>
        buildInitialForm(deal, currentUserId),
    );
    const [showDuration, setShowDuration] = useState(false);
    const [showMore, setShowMore] = useState(false);
    const { createMeeting, isCreating, errors, clearErrors } =
        useDealMeetingCreate(deal);

    const isVideoMeeting = form.platform === "zoho";
    const defaultReminderLabel = useMemo(
        () => formatDefaultRemindersLabel(DEFAULT_REMINDERS),
        [],
    );

    useEffect(() => {
        if (!open) {
            setForm(buildInitialForm(deal, currentUserId));
            setShowDuration(false);
            setShowMore(false);
            clearErrors();
        }
    }, [clearErrors, currentUserId, deal, open]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    const updateForm = (patch: Partial<MeetingFormState>) => {
        setForm((current) => ({ ...current, ...patch }));
    };

    const handleDurationSelect = (duration: number) => {
        const nextDuration = form.duration === duration ? null : duration;
        updateForm({
            duration: nextDuration,
            endTime:
                nextDuration && form.startTime
                    ? addMinutesToTime(form.startTime, nextDuration)
                    : form.endTime,
        });
    };

    const handleStartTimeChange = (startTime: string) => {
        updateForm({
            startTime,
            endTime:
                form.duration && startTime
                    ? addMinutesToTime(startTime, form.duration)
                    : form.endTime,
        });
    };

    const handleEndTimeChange = (endTime: string) => {
        const duration =
            form.startTime && endTime
                ? diffMinutesBetweenTimes(form.startTime, endTime)
                : null;

        updateForm({
            endTime,
            duration,
        });
    };

    const handlePlatformChange = (platform: MeetingPlatform) => {
        updateForm({
            platform,
            meetingLink: platform === "zoho" ? form.meetingLink : "",
        });
    };

    const handleAddReminder = () => {
        updateForm({
            reminders: [...form.reminders, { time: 10, type: "minute" }],
        });
    };

    const handleReminderChange = (
        index: number,
        patch: Partial<Reminder>,
    ) => {
        updateForm({
            reminders: form.reminders.map((reminder, reminderIndex) =>
                reminderIndex === index
                    ? { ...reminder, ...patch }
                    : reminder,
            ),
        });
    };

    const handleRemoveReminder = (index: number) => {
        updateForm({
            reminders: form.reminders.filter(
                (_, reminderIndex) => reminderIndex !== index,
            ),
        });
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

            <DealModalField label={td("Meeting type")}>
                <select
                    value={form.meetingTypeId ?? ""}
                    onChange={(event) =>
                        updateForm({
                            meetingTypeId: event.target.value
                                ? Number(event.target.value)
                                : null,
                        })
                    }
                >
                    <option value="">{td("Select meeting type")}</option>
                    {meetingTypes.map((meetingType) => (
                        <option key={meetingType.id} value={meetingType.id}>
                            {meetingType.name}
                        </option>
                    ))}
                </select>
            </DealModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={td("Date")}>
                    <input
                        type="date"
                        value={form.date}
                        min={new Date().toISOString().split("T")[0]}
                        onChange={(event) =>
                            updateForm({ date: event.target.value })
                        }
                    />
                </DealModalField>

                <DealModalField label={td("Platform")}>
                    <select
                        value={form.platform}
                        onChange={(event) =>
                            handlePlatformChange(
                                event.target.value as MeetingPlatform,
                            )
                        }
                    >
                        {MEETING_PLATFORM_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {td(option.label)}
                            </option>
                        ))}
                    </select>
                </DealModalField>
            </div>

            <DealModalField label={td("Start time")}>
                <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                        handleStartTimeChange(event.target.value)
                    }
                />
                <div className="mt-2">
                    <button
                        type="button"
                        onClick={() => setShowDuration((current) => !current)}
                        className="border-none bg-transparent p-0 text-[11px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                    >
                        {showDuration ? td("Hide duration") : `+ ${td("Add duration")}`}
                    </button>
                    {showDuration && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {MEETING_DURATION_OPTIONS.map((option) => {
                                const active = form.duration === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            handleDurationSelect(option.value)
                                        }
                                        className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                        style={{
                                            borderColor: active
                                                ? T.NAVY
                                                : T.BORDER,
                                            background: active
                                                ? T.NAVY
                                                : T.WHITE,
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
                </div>
            </DealModalField>

            <DealModalField label={td("End time")}>
                <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) =>
                        handleEndTimeChange(event.target.value)
                    }
                />
            </DealModalField>

            {isVideoMeeting && (
                <DealModalField label={td("Meeting link")}>
                    <input
                        value={form.meetingLink}
                        onChange={(event) =>
                            updateForm({ meetingLink: event.target.value })
                        }
                        placeholder={td(
                            "Meeting link will be auto-generated",
                        )}
                        readOnly
                        disabled
                    />
                    <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                        {td(
                            "Auto-generated for video meetings after scheduling.",
                        )}
                    </p>
                </DealModalField>
            )}

            <DealModalField label={td("Meeting participants")}>
                <div className="[&_.ant-select]:w-full">
                    <FormDataSelector
                        type="employees"
                        mode="multiple"
                        value={form.participants}
                        onChange={(value) =>
                            updateForm({
                                participants: Array.isArray(value)
                                    ? value
                                    : [],
                            })
                        }
                        placeholder={td("Select meeting participants")}
                        disabled={isCreating}
                    />
                </div>
            </DealModalField>

            <div className="mb-3">
                <button
                    type="button"
                    onClick={() => setShowMore((current) => !current)}
                    className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[11px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                >
                    <DealIcon
                        name={showMore ? "chevron-up" : "chevron-down"}
                        size={12}
                        color={T.BLUE}
                    />
                    {showMore ? td("Less") : td("More")}
                </button>
            </div>

            {showMore && (
                <div className="space-y-3 border-t border-[#e2e5ea] pt-3">
                    <DealModalField label={td("Meeting agenda")}>
                        <textarea
                            value={form.remark}
                            onChange={(event) =>
                                updateForm({ remark: event.target.value })
                            }
                            placeholder={td(
                                "Enter meeting agenda, details, or remarks...",
                            )}
                            rows={4}
                            style={{ resize: "vertical" }}
                        />
                    </DealModalField>

                    <div
                        className="rounded-lg border px-3 py-2.5"
                        style={{
                            borderColor: T.BLUE_MID,
                            background: T.BLUE_LIGHT,
                        }}
                    >
                        <div className="flex items-start gap-2">
                            <DealIcon name="clock" size={13} color={T.BLUE} />
                            <div>
                                <p className="mb-0 text-xs font-semibold text-[#1a4f80]">
                                    {td("Automatic reminders included")}
                                </p>
                                <p className="mb-0 mt-0.5 text-[11px] text-[#1a6bb5]">
                                    {td("Participants will be notified")}{" "}
                                    {defaultReminderLabel}{" "}
                                    {td("before the meeting.")}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[#9ca3af]">
                            {td("Additional custom reminders")}
                        </p>

                        {form.reminders.length > 0 && (
                            <div className="mb-2 space-y-2">
                                {form.reminders.map((reminder, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 rounded-md border border-[#e2e5ea] bg-white p-2"
                                    >
                                        <input
                                            type="number"
                                            min={1}
                                            max={1440}
                                            value={reminder.time}
                                            onChange={(event) =>
                                                handleReminderChange(index, {
                                                    time: Number(
                                                        event.target.value,
                                                    ),
                                                })
                                            }
                                            className="w-16"
                                        />
                                        <select
                                            value={reminder.type}
                                            onChange={(event) =>
                                                handleReminderChange(index, {
                                                    type: event.target
                                                        .value as Reminder["type"],
                                                })
                                            }
                                            className="w-24"
                                        >
                                            <option value="minute">
                                                {td("Minutes")}
                                            </option>
                                            <option value="hour">
                                                {td("Hours")}
                                            </option>
                                            <option value="day">
                                                {td("Days")}
                                            </option>
                                        </select>
                                        <span className="text-[11px] text-[#9ca3af]">
                                            {td("before meeting")}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemoveReminder(index)
                                            }
                                            className="ml-auto border-none bg-transparent text-[11px] text-red-600"
                                        >
                                            {td("Remove")}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <DealButton
                            variant="ghost"
                            onClick={handleAddReminder}
                            style={{ fontSize: 11, padding: "4px 10px" }}
                        >
                            + {td("Add custom reminder")}
                        </DealButton>
                    </div>
                </div>
            )}
        </DealModal>
    );
}
