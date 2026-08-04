import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import AssigneeField from "@/Components/Redesign/fields/AssigneeField";
import type { Reminder } from "@/Types/api/deal-followup";
import {
    DEFAULT_MEETING_REMINDERS,
    MEETING_DURATION_OPTIONS,
    MEETING_PLATFORM_OPTIONS,
    MeetingFormState,
    MeetingPlatform,
    addMinutesToTime,
    diffMinutesBetweenTimes,
    reminderLabel,
} from "./meetingFormUtils";

interface MeetingFormFieldsProps {
    form: MeetingFormState;
    onChange: (patch: Partial<MeetingFormState>) => void;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    disabled?: boolean;
    showExistingMeetingLinkHint?: boolean;
}

const REMINDER_UNIT_OPTIONS: Array<{ value: Reminder["type"]; labelKey: string }> = [
    { value: "minute", labelKey: "reminder_unit_minutes" },
    { value: "hour", labelKey: "reminder_unit_hours" },
    { value: "day", labelKey: "reminder_unit_days" },
];

const PLATFORM_LABEL_KEYS: Record<MeetingPlatform, string> = {
    zoho: "platform_video_call",
    physical: "platform_in_person",
    phone: "platform_phone",
};

export default function MeetingFormFields({
    form,
    onChange,
    meetingTypes,
    disabled = false,
    showExistingMeetingLinkHint = false,
}: MeetingFormFieldsProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [showDuration, setShowDuration] = useState(Boolean(form.duration));
    const [showMore, setShowMore] = useState(form.reminders.length > 0);
    const [reminderTime, setReminderTime] = useState(1);
    const [reminderUnit, setReminderUnit] = useState<Reminder["type"]>("day");

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

    const isReminderAlreadyAdded = (candidate: Reminder) =>
        DEFAULT_MEETING_REMINDERS.some(
            (reminder) =>
                reminder.time === candidate.time &&
                reminder.type === candidate.type,
        ) ||
        form.reminders.some(
            (reminder) =>
                reminder.time === candidate.time &&
                reminder.type === candidate.type,
        );

    const canAddReminder =
        reminderTime >= 1 &&
        !isReminderAlreadyAdded({ time: reminderTime, type: reminderUnit });

    const handleAddReminder = () => {
        if (disabled || !canAddReminder) return;
        updateForm({
            reminders: [
                ...form.reminders,
                { time: reminderTime, type: reminderUnit },
            ],
        });
    };

    return (
        <>
            <ModalField label={t("pages.deals.workspace.meetings.meeting_type")}>
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
                    <option value="">
                        {t("pages.deals.workspace.meetings.select_meeting_type")}
                    </option>
                    {meetingTypes.map((meetingType) => (
                        <option key={meetingType.id} value={meetingType.id}>
                            {meetingType.name}
                        </option>
                    ))}
                </select>
            </ModalField>

            <ModalField label={t("pages.deals.workspace.meetings.agenda")}>
                <textarea
                    value={form.remark}
                    disabled={disabled}
                    onChange={(event) =>
                        updateForm({ remark: event.target.value })
                    }
                    placeholder={t("pages.deals.workspace.meetings.agenda_placeholder")}
                    rows={3}
                    style={{ resize: "vertical" }}
                />
            </ModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModalField label={t("pages.deals.workspace.meetings.date_label")}>
                    <input
                        type="date"
                        value={form.date}
                        min={new Date().toISOString().split("T")[0]}
                        disabled={disabled}
                        onChange={(event) =>
                            updateForm({ date: event.target.value })
                        }
                    />
                </ModalField>

                <ModalField label={t("pages.deals.workspace.meetings.platform")}>
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
                                {t(
                                    `pages.deals.workspace.meetings.${PLATFORM_LABEL_KEYS[option.value]}`,
                                )}
                            </option>
                        ))}
                    </select>
                </ModalField>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModalField label={t("pages.deals.workspace.meetings.start_time")}>
                    <input
                        type="time"
                        value={form.startTime}
                        disabled={disabled}
                        onChange={(event) =>
                            handleStartTimeChange(event.target.value)
                        }
                    />
                </ModalField>

                <ModalField label={t("pages.deals.workspace.meetings.end_time")}>
                    <input
                        type="time"
                        value={form.endTime}
                        disabled={disabled}
                        onChange={(event) =>
                            handleEndTimeChange(event.target.value)
                        }
                    />
                </ModalField>
            </div>

            {form.startTime && (
                <div className="mb-3">
                    <button
                        type="button"
                        onClick={() => setShowDuration((current) => !current)}
                        className="border-none bg-transparent p-0 text-[12px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                    >
                        {showDuration
                            ? t("pages.deals.workspace.meetings.hide_duration")
                            : `+ ${t("pages.deals.workspace.meetings.add_duration")}`}
                    </button>
                    {showDuration && (
                        <div className="mt-2 flex flex-wrap gap-2">
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
                                        className="rounded-lg border px-4 py-2 text-[13px] font-semibold transition-colors"
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
            )}

            {isVideoMeeting && (
                <ModalField label={t("pages.deals.workspace.meetings.meeting_link")}>
                    {form.meetingLink ? (
                        <div
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5"
                            style={{
                                background: T.BLUE_LIGHT,
                                border: `1px solid ${T.BLUE_MID}`,
                            }}
                        >
                            <span
                                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md"
                                style={{ background: T.WHITE }}
                            >
                                <Icon
                                    name="video"
                                    size={14}
                                    color={T.BLUE}
                                />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div
                                    className="text-[12px] font-semibold uppercase tracking-wide"
                                    style={{ color: T.BLUE }}
                                >
                                    {t("pages.deals.workspace.meetings.video_call")}
                                </div>
                                <a
                                    href={form.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block truncate text-xs font-medium no-underline"
                                    style={{ color: T.NAVY }}
                                    title={form.meetingLink}
                                >
                                    {form.meetingLink}
                                </a>
                            </div>
                            <a
                                href={form.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={t("pages.deals.workspace.meetings.open_meeting_link")}
                                className="flex flex-shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold no-underline"
                                style={{ background: T.BLUE, color: T.WHITE }}
                            >
                                <Icon
                                    name="external-link"
                                    size={12}
                                    color={T.WHITE}
                                />
                                {t("pages.deals.workspace.meetings.join")}
                            </a>
                        </div>
                    ) : (
                        <div
                            className="flex items-center gap-2 rounded-lg px-3 py-2.5"
                            style={{
                                background: T.SURFACE_2,
                                border: `1px dashed ${T.BORDER}`,
                            }}
                        >
                            <Icon
                                name="video"
                                size={14}
                                color={T.TEXT_HINT}
                            />
                            <p
                                className="text-[12px] italic"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {t("pages.deals.workspace.meetings.auto_generated_link_hint")}
                            </p>
                        </div>
                    )}
                    {form.meetingLink && showExistingMeetingLinkHint && (
                        <p className="mt-1.5 text-[12px]" style={{ color: T.TEXT_HINT }}>
                            {t("pages.deals.workspace.meetings.existing_link_hint")}
                        </p>
                    )}
                </ModalField>
            )}

            <ModalField label={t("pages.deals.workspace.meetings.participants_field")}>
                <AssigneeField
                    value={form.participants}
                    onChange={(participants) => updateForm({ participants })}
                    disabled={disabled}
                />
            </ModalField>

            <div className="mb-3">
                <button
                    type="button"
                    onClick={() => setShowMore((current) => !current)}
                    className="flex items-center gap-1.5 border-none bg-transparent p-0 text-[12px] font-semibold text-[#1a6bb5] hover:text-[#145890]"
                >
                    <Icon
                        name={showMore ? "chevron-up" : "chevron-down"}
                        size={12}
                        color={T.BLUE}
                    />
                    {showMore ? t("pages.deals.common.less") : t("pages.deals.common.more")}
                </button>
            </div>

            {showMore && (
                <div className="space-y-3 border-t border-[#e2e5ea] pt-3">
                    {/* v2.2 Reminders field (deal-v2-2.jsx:2660-2682) — default
                       (non-removable) pills + custom (removable) pills, plus a
                       customizable adder (choose amount + minutes/hours/days)
                       replacing the old fixed "+ 1 day before" button. */}
                    <ModalField label={t("pages.deals.workspace.meetings.reminders")}>
                        <div className="flex flex-wrap items-center gap-2">
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
                                    className="dr-pill dr-pill-blue"
                                    style={{
                                        fontSize: 12,
                                        padding: "5px 6px 5px 12px",
                                        gap: 6,
                                    }}
                                >
                                    {td(reminderLabel(reminder))}
                                    <button
                                        type="button"
                                        disabled={disabled}
                                        aria-label={`${t("pages.deals.workspace.meetings.remove_reminder")} ${reminderLabel(reminder)}`}
                                        onClick={() =>
                                            updateForm({
                                                reminders: form.reminders.filter(
                                                    (_, i) => i !== index,
                                                ),
                                            })
                                        }
                                        style={{
                                            background: "rgba(20,83,140,0.12)",
                                            border: "none",
                                            cursor: "pointer",
                                            color: "#14538c",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "50%",
                                            width: 16,
                                            height: 16,
                                            padding: 0,
                                        }}
                                    >
                                        <Icon name="x" size={11} />
                                    </button>
                                </span>
                            ))}
                        </div>

                        <div
                            className="mt-3 rounded-lg"
                            style={{
                                background: T.SURFACE_2,
                                border: `1px solid ${T.BORDER}`,
                                padding: "11px 12px",
                            }}
                        >
                            <div
                                className="mb-2 text-[12px] font-semibold uppercase"
                                style={{
                                    color: T.TEXT_HINT,
                                    letterSpacing: "0.05em",
                                }}
                            >
                                {t("pages.deals.workspace.meetings.add_custom_reminder")}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    min={1}
                                    value={reminderTime}
                                    disabled={disabled}
                                    aria-label={t("pages.deals.workspace.meetings.reminder_amount")}
                                    onChange={(event) =>
                                        setReminderTime(
                                            Math.max(
                                                1,
                                                Math.floor(
                                                    Number(event.target.value) ||
                                                        1,
                                                ),
                                            ),
                                        )
                                    }
                                    style={{ width: 68, textAlign: "center" }}
                                />
                                <select
                                    value={reminderUnit}
                                    disabled={disabled}
                                    aria-label={t("pages.deals.workspace.meetings.reminder_unit")}
                                    onChange={(event) =>
                                        setReminderUnit(
                                            event.target
                                                .value as Reminder["type"],
                                        )
                                    }
                                    style={{ flex: 1, width: "auto", minWidth: 0 }}
                                >
                                    {REMINDER_UNIT_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {t(
                                                `pages.deals.workspace.meetings.${option.labelKey}`,
                                            )}
                                        </option>
                                    ))}
                                </select>
                                <span
                                    className="text-[12px]"
                                    style={{
                                        color: T.TEXT_MUTED,
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {t("pages.deals.workspace.meetings.before")}
                                </span>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    disabled={disabled || !canAddReminder}
                                    title={
                                        !canAddReminder
                                            ? t(
                                                  "pages.deals.workspace.meetings.reminder_already_added",
                                              ) ||
                                              "That reminder is already included (defaults cover 1h, 30m, 15m, and 5m)"
                                            : undefined
                                    }
                                    onClick={handleAddReminder}
                                >
                                    {t("pages.deals.common.add")}
                                </Button>
                            </div>
                            {!canAddReminder && reminderTime >= 1 ? (
                                <p
                                    className="mt-1.5 text-[11px]"
                                    style={{ color: T.TEXT_HINT }}
                                >
                                    {td(
                                        "A 5-minute reminder is already included by default (along with 15m, 30m, and 1h).",
                                    )}
                                </p>
                            ) : null}
                        </div>

                        <p className="mt-2 text-[12px]" style={{ color: T.TEXT_HINT }}>
                            {t("pages.deals.workspace.meetings.default_reminders_hint")}
                        </p>
                    </ModalField>
                </div>
            )}
        </>
    );
}
