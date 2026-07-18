import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealButton from "../../primitives/DealButton";
import DealIcon from "../../primitives/DealIcon";
import { DealModalField } from "../../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import DealAssigneeField from "../DealAssigneeField";
import {
    DEFAULT_MEETING_REMINDERS,
    MEETING_DURATION_OPTIONS,
    MEETING_PLATFORM_OPTIONS,
    MeetingFormState,
    MeetingPlatform,
    addMinutesToTime,
    diffMinutesBetweenTimes,
    reminderLabel,
} from "../meetingFormUtils";

interface DealMeetingFormFieldsProps {
    form: MeetingFormState;
    onChange: (patch: Partial<MeetingFormState>) => void;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    disabled?: boolean;
    showExistingMeetingLinkHint?: boolean;
}

export default function DealMeetingFormFields({
    form,
    onChange,
    meetingTypes,
    disabled = false,
    showExistingMeetingLinkHint = false,
}: DealMeetingFormFieldsProps) {
    const { td } = useTd();
    const [showDuration, setShowDuration] = useState(Boolean(form.duration));
    const [showMore, setShowMore] = useState(
        Boolean(form.remark.trim() || form.reminders.length > 0),
    );

    const isVideoMeeting = form.platform === "zoho";

    const updateForm = (patch: Partial<MeetingFormState>) => {
        onChange(patch);
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

    return (
        <>
            <DealModalField label={td("Meeting type")}>
                <select
                    value={form.meetingTypeId ?? ""}
                    disabled={disabled}
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
                        disabled={disabled}
                        onChange={(event) =>
                            updateForm({ date: event.target.value })
                        }
                    />
                </DealModalField>

                <DealModalField label={td("Platform")}>
                    <select
                        value={form.platform}
                        disabled={disabled}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DealModalField label={td("Start time")}>
                    <input
                        type="time"
                        value={form.startTime}
                        disabled={disabled}
                        onChange={(event) =>
                            handleStartTimeChange(event.target.value)
                        }
                    />
                </DealModalField>

                <DealModalField label={td("End time")}>
                    <input
                        type="time"
                        value={form.endTime}
                        disabled={disabled}
                        onChange={(event) =>
                            handleEndTimeChange(event.target.value)
                        }
                    />
                </DealModalField>
            </div>

            <div className="mb-3">
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
                                    disabled={disabled}
                                    onClick={() =>
                                        handleDurationSelect(option.value)
                                    }
                                    className="rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors"
                                    style={{
                                        borderColor: active ? T.NAVY : T.BORDER,
                                        background: active ? T.NAVY : T.WHITE,
                                        color: active ? T.WHITE : T.TEXT_MUTED,
                                    }}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {isVideoMeeting && (
                <DealModalField label={td("Meeting link")}>
                    {form.meetingLink ? (
                        <div>
                            <a
                                href={form.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[13px] font-medium text-[#1a6bb5] no-underline hover:text-[#145890]"
                            >
                                {form.meetingLink}
                            </a>
                            {showExistingMeetingLinkHint && (
                                <p className="mt-1.5 text-[11px] text-[#9ca3af]">
                                    {td("Existing meeting link is shown for reference.")}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className="text-[13px] italic" style={{ color: T.TEXT_MUTED }}>
                            {td("Auto-generated for video meetings after scheduling.")}
                        </p>
                    )}
                </DealModalField>
            )}

            <DealModalField label={td("Meeting participants")}>
                <DealAssigneeField
                    value={form.participants}
                    onChange={(participants) => updateForm({ participants })}
                    disabled={disabled}
                />
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
                            disabled={disabled}
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

                    {/* v2.2 Reminders field (deal-v2-2.jsx:2660-2682) — default
                       (non-removable) pills + custom (removable) pills in one
                       row, replacing the separate "automatic reminders" info
                       box and number/select editor rows this used to be. */}
                    <DealModalField label={td("Reminders")}>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {DEFAULT_MEETING_REMINDERS.map((reminder) => (
                                <span
                                    key={reminderLabel(reminder)}
                                    className="dr-pill dr-pill-gray"
                                >
                                    {td(reminderLabel(reminder))}
                                </span>
                            ))}
                            {form.reminders.map((reminder, index) => (
                                <span
                                    key={`custom-${index}`}
                                    className="inline-flex items-center gap-1"
                                >
                                    <span className="dr-pill dr-pill-blue">
                                        {td(reminderLabel(reminder))}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`${td("Remove reminder")} ${reminderLabel(reminder)}`}
                                        onClick={() =>
                                            updateForm({
                                                reminders: form.reminders.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            })
                                        }
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            color: T.TEXT_MUTED,
                                            display: "flex",
                                            padding: 2,
                                        }}
                                    >
                                        <DealIcon name="x" size={11} />
                                    </button>
                                </span>
                            ))}
                            <DealButton
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                onClick={() =>
                                    updateForm({
                                        reminders: [
                                            ...form.reminders,
                                            { time: 1, type: "day" },
                                        ],
                                    })
                                }
                            >
                                + {td("1 day before")}
                            </DealButton>
                        </div>
                        <p className="mt-1.5 text-[11px]" style={{ color: T.TEXT_HINT }}>
                            {td("Default reminders always apply and can't be removed.")}
                        </p>
                    </DealModalField>
                </div>
            )}
        </>
    );
}
