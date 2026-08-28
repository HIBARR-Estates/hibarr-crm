import React, { useEffect, useRef, useState } from "react";
import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import {
    Modal,
    Tooltip,
    Button,
    DatePicker,
    TimePicker,
    InputNumber,
    Form,
    Avatar,
    message,
} from "antd";
import "./followup-modal.css";
import {
    CalendarOutlined,
    EditOutlined,
    EnvironmentOutlined,
    UserOutlined,
    VideoCameraOutlined,
    TeamOutlined,
    PhoneOutlined,
    ThunderboltOutlined,
    ScheduleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
} from "@/lib/companyDateTime";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import utc from "dayjs/plugin/utc";
import { usePage, router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { ContentRenderer } from "@/Components/ContentRenderer";
import CalendarSyncStatus from "@/Features/Meetings/CalendarSyncStatus";

dayjs.extend(utc);

const DEFAULT_DURATION = 30;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

const getMeetingIcon = (location: string) => {
    switch (location) {
        case "zoom":
            return <VideoCameraOutlined style={{ color: "#2D8CFF" }} />;
        case "teams":
            return <TeamOutlined style={{ color: "#6264A7" }} />;
        case "meet":
        case "google_meet":
            return <VideoCameraOutlined style={{ color: "#34A853" }} />;
        case "phone":
            return <PhoneOutlined style={{ color: "#FF6B35" }} />;
        case "zoho":
            return <VideoCameraOutlined style={{ color: "#1890ff" }} />;
        default:
            return <EnvironmentOutlined style={{ color: "#666" }} />;
    }
};

const getLocationLabel = (location: string): string => {
    const labels: Record<string, string> = {
        zoho: "Video Meeting",
        zoom: "Zoom",
        teams: "Microsoft Teams",
        meet: "Google Meet",
        google_meet: "Google Meet",
        phone: "Phone",
        office: "Office",
        physical: "Physical",
        skype: "Skype",
        other: "Other",
    };
    return labels[location] ?? location;
};

const isLiveMeeting = (followup: DealFollowup): boolean => {
    if (followup.status !== "scheduled") return false;
    const duration =
        followup.effective_duration ?? followup.duration ?? DEFAULT_DURATION;
    const start = dayjs.utc(followup.next_follow_up_date).local();
    const end = start.add(duration, "minute");
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(end);
};

const getElapsedMinutes = (followup: DealFollowup): number | null => {
    if (!isLiveMeeting(followup)) return null;
    const start = dayjs.utc(followup.next_follow_up_date).local();
    return Math.floor(dayjs().diff(start, "minute", true));
};

// ─── Reschedule Modal ────────────────────────────────────────────────────────

interface RescheduleModalProps {
    open: boolean;
    onClose: () => void;
    followup: DealFollowup;
}

const RescheduleModal: React.FC<RescheduleModalProps> = ({
    open,
    onClose,
    followup,
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            setLoading(true);
            setError(null);

            const browserTimezone =
                Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

            const csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute("content") || "";

            const res = await fetch(
                `/account/meetings/${followup.id}/reschedule`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "X-CSRF-TOKEN": csrfToken,
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    body: JSON.stringify({
                        next_follow_up_date:
                            values.next_follow_up_date.format("DD-MM-YYYY"),
                        start_time: values.start_time.format("HH:mm:ss"),
                        duration: values.duration || null,
                        timezone: browserTimezone,
                    }),
                },
            );

            const json = await res.json();

            if (json.success) {
                onClose();
                router.reload();
            } else {
                setError(json.message ?? "Failed to reschedule.");
            }
        } catch (err: any) {
            if (err?.errorFields) return; // form validation error
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const followupDate = dayjs.utc(followup.next_follow_up_date).local();
    const effectiveDuration =
        followup.duration ?? followup.effective_duration ?? DEFAULT_DURATION;

    return (
        <Modal
            title="Reschedule Meeting"
            open={open}
            onCancel={onClose}
            destroyOnClose
            footer={[
                <Button key="cancel" onClick={onClose} disabled={loading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={loading}
                    onClick={handleSubmit}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    Reschedule
                </Button>,
            ]}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    next_follow_up_date: followupDate,
                    start_time: followupDate,
                    duration: effectiveDuration,
                }}
                className="mt-4"
            >
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                        <p className="text-red-600 text-sm mb-0">{error}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                        name="next_follow_up_date"
                        label="New Date"
                        rules={[
                            {
                                required: true,
                                message: "Select a date",
                            },
                        ]}
                    >
                        <DatePicker
                            className="w-full"
                            format={companyDateDayjsFormat()}
                            disabledDate={(current) =>
                                current && current < dayjs().startOf("day")
                            }
                        />
                    </Form.Item>

                    <Form.Item
                        name="start_time"
                        label="New Time"
                        rules={[
                            {
                                required: true,
                                message: "Select a time",
                            },
                        ]}
                    >
                        <TimePicker className="w-full" format={companyTimeDayjsFormat()} />
                    </Form.Item>
                </div>

                <Form.Item
                    name="duration"
                    label="Duration (minutes)"
                    tooltip="How long the meeting is expected to last."
                >
                    <InputNumber
                        min={5}
                        max={480}
                        placeholder="30"
                        className="w-full"
                        addonAfter="min"
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

// ─── Section ─────────────────────────────────────────────────────────────────

interface SectionProps {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

const Section: React.FC<SectionProps> = ({
    title,
    icon,
    children,
    className = "",
}) => (
    <div className={`bg-gray-50/70 rounded-xl px-5 py-4 ${className}`}>
        <div className="flex items-center gap-1.5 mb-3">
            {icon && <span className="text-xs opacity-50">{icon}</span>}
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest">
                {title}
            </span>
        </div>
        <div>{children}</div>
    </div>
);

// ─── Detail Field (vertical stack) ───────────────────────────────────────────

const DetailField: React.FC<{
    label: string;
    children: React.ReactNode;
}> = ({ label, children }) => (
    <div>
        <span className="text-[11px] text-gray-400 font-medium block mb-0.5">
            {label}
        </span>
        <span className="text-[13px] text-gray-800 leading-snug">
            {children}
        </span>
    </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

interface Props extends IModalProps {
    deal?: Deal;
    lead?: Lead;
    followup: DealFollowup;
    onEdit?: () => void;
}

const ViewFollowup: React.FC<Props> = ({
    deal,
    lead,
    followup,
    onClose,
    open,
    onEdit,
}) => {
    const { props } = usePage<any>();
    const { td } = useTd();
    const { formatDate, formatTime, formatDateTime } = useUserDateTime();
    const currentUserId = props?.auth?.user?.id;
    const permissions = props?.permissions ?? {};
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [attendance, setAttendance] = useState<boolean | null | undefined>(
        followup?.client_attended,
    );
    const [attendanceSaving, setAttendanceSaving] = useState(false);
    const attendanceFollowupIdRef = useRef<number | undefined>(followup?.id);

    useEffect(() => {
        attendanceFollowupIdRef.current = followup?.id;
        setAttendance(followup?.client_attended);
    }, [followup?.id, followup?.client_attended]);

    const handleSetAttendance = async (value: boolean | null) => {
        if (!followup?.id || attendanceSaving) return;

        const requestFollowupId = followup.id;
        const nextValue = attendance === value ? null : value;

        setAttendanceSaving(true);
        try {
            const csrfToken =
                document
                    .querySelector('meta[name="csrf-token"]')
                    ?.getAttribute("content") || "";

            const res = await fetch(
                `/account/meetings/${requestFollowupId}/confirm-attendance`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "X-CSRF-TOKEN": csrfToken,
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    body: JSON.stringify({ client_attended: nextValue }),
                },
            );

            if (attendanceFollowupIdRef.current !== requestFollowupId) {
                return;
            }

            let json: { success?: boolean; client_attended?: boolean | null; message?: string } = {};
            try {
                json = await res.json();
            } catch {
                message.error("Could not read attendance response.");
                return;
            }

            if (!res.ok || !json.success) {
                message.error(json.message || "Could not update attendance.");
                return;
            }

            setAttendance(json.client_attended);
        } catch {
            if (attendanceFollowupIdRef.current === requestFollowupId) {
                message.error("Could not update attendance.");
            }
        } finally {
            if (attendanceFollowupIdRef.current === requestFollowupId) {
                setAttendanceSaving(false);
            }
        }
    };

    const live = isLiveMeeting(followup);
    const elapsedMinutes = getElapsedMinutes(followup);
    const meetingInstant = followup?.next_follow_up_date;
    const effectiveDuration =
        followup?.effective_duration ?? followup?.duration ?? DEFAULT_DURATION;
    const isCreator = followup?.added_by?.id === currentUserId;
    const canEditAttendance =
        permissions.edit_lead_follow_up === "all" ||
        (permissions.edit_lead_follow_up === "added" && isCreator);
    const meetingHasStarted =
        !!followup?.next_follow_up_date &&
        !dayjs.utc(followup.next_follow_up_date).local().isAfter(dayjs());

    const featureEnabled =
        props?.featureFlags?.["integrations.zoho-calendar-sync"] === true;
    const shouldShowCalendarSync =
        featureEnabled &&
        isCreator &&
        (followup?.zoho_calendar_job_id ||
            followup?.zoho_calendar_sync_status);

    const hasValidLink =
        followup?.meeting_link &&
        isSafeUrl(followup.meeting_link) &&
        !["office", "phone", "physical"].includes(followup?.location);

    const participantUsers = followup?.participant_users ?? [];
    const isNonVideoLocation = ["office", "phone", "physical"].includes(
        followup?.location,
    );

    const meetingTitle = td(followup?.meeting_type?.name || "Follow-up Meeting", { source: "en" });

    const handleEdit = () => {
        onClose();
        if (onEdit) onEdit();
    };

    return (
        <>
            <Modal
                className="followup-modal"
                title={null}
                open={open}
                onCancel={() => onClose()}
                footer={null}
                width={620}
                centered
                destroyOnHidden
                maskClosable
                closable
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="px-6 pt-6 pb-4 pr-14 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                        {followup?.meeting_type && (
                            <span className="text-[11px] font-medium rounded-full px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100">
                                {td(followup.meeting_type.name, { source: "en" })}
                            </span>
                        )}
                        {live && (
                            <span className="text-[11px] font-medium rounded-full px-2.5 py-1 bg-red-100 text-red-700 animate-pulse inline-flex items-center gap-0.5">
                                <ThunderboltOutlined className="text-[10px]" />
                                Live
                            </span>
                        )}
                        <span
                            className={`text-[11px] font-medium rounded-full px-2.5 py-1 capitalize border ${live
                                    ? "bg-red-100 text-red-700 border-red-200"
                                    : followup?.status === "scheduled"
                                        ? "bg-amber-50 text-amber-700 border-amber-100"
                                        : followup?.status === "completed"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                            : "bg-gray-100 text-gray-600 border-gray-200"
                                }`}
                        >
                            {live ? "In Progress" : followup?.status}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <Tooltip title={meetingTitle}>
                            <h2 className="text-[18px] font-bold text-gray-900 leading-tight truncate">
                                {meetingTitle}
                            </h2>
                        </Tooltip>
                        {onEdit && (
                            <Tooltip title="Edit meeting">
                                <button
                                    onClick={handleEdit}
                                    className="shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-1"
                                >
                                    <EditOutlined className="text-sm" />
                                </button>
                            </Tooltip>
                        )}
                    </div>
                </div>

                {/* ── Scrollable body ─────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

                    {/* Hero date / time / duration */}
                    <div className="flex items-stretch gap-3">
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 py-4 px-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Date</p>
                            <p className="text-[20px] font-black text-slate-900 leading-none">{formatDate(meetingInstant)}</p>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center bg-blue-600 rounded-2xl py-4 px-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1">Time</p>
                            <p className="text-[26px] font-black text-white leading-none tabular-nums">
                                {formatTime(meetingInstant)}
                            </p>
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 py-4 px-3 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Duration</p>
                            <p className="text-[20px] font-black text-slate-900 leading-none">{effectiveDuration}</p>
                            <p className="text-[12px] text-slate-500 mt-0.5">
                                min{live && elapsedMinutes !== null && (
                                    <span className="text-red-500 ml-1">({elapsedMinutes}m in)</span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Properties table */}
                    <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                        {/* Platform */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0">Platform</span>
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                                {getMeetingIcon(followup?.location || "")}
                                {getLocationLabel(followup?.location || "office")}
                            </span>
                            {hasValidLink && (
                                <a
                                    href={followup.meeting_link!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto text-[12px] font-semibold text-blue-600 hover:underline shrink-0"
                                >
                                    Join →
                                </a>
                            )}
                        </div>

                        {/* Calendar Sync */}
                        {shouldShowCalendarSync && (
                            <div className="flex items-center gap-3 px-4 py-3">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0">
                                    Calendar Sync
                                </span>
                                <CalendarSyncStatus
                                    followup={followup}
                                    featureEnabled={featureEnabled}
                                    isCreator={isCreator}
                                />
                            </div>
                        )}

                        {/* Scheduled by */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0">Scheduled by</span>
                            {followup?.added_by ? (
                                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-800">
                                    <Avatar
                                        size={22}
                                        src={followup.added_by.image_url}
                                        icon={<UserOutlined />}
                                        className="flex-shrink-0"
                                    />
                                    {followup.added_by.name}
                                </span>
                            ) : (
                                <span className="text-[13px] text-slate-400">--</span>
                            )}
                        </div>

                        {/* Lead (when no deal) */}
                        {!deal && lead && (
                            <div className="flex items-start gap-3 px-4 py-3">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 mt-0.5">Lead</span>
                                <div className="grid grid-cols-2 flex-1 gap-x-4 gap-y-1">
                                    <div>
                                        <p className="text-[10px] text-slate-400 mb-0.5">Name</p>
                                        <p className="text-[13px] font-medium text-slate-800 mb-0">{lead.client_name_salutation || lead.client_name || "--"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 mb-0.5">Email</p>
                                        <p className="text-[13px] text-slate-600 mb-0">{lead.client_email || <span className="text-slate-400">--</span>}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Deal */}
                        {deal && (
                            <div className="flex items-start gap-3 px-4 py-3">
                                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 mt-0.5">Deal</span>
                                <div className="grid grid-cols-2 flex-1 gap-x-4 gap-y-1">
                                    <div>
                                        <p className="text-[10px] text-slate-400 mb-0.5">Name</p>
                                        {deal?.name ? (
                                            <a
                                                href={`/account/deals/${deal.id}`}
                                                className="text-[13px] font-medium text-blue-600 hover:underline mb-0 block"
                                                onClick={(e) => { e.preventDefault(); router.visit(`/account/deals/${deal.id}`); }}
                                            >
                                                {td(deal.name)}
                                            </a>
                                        ) : (
                                            <p className="text-[13px] text-slate-400 mb-0">--</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 mb-0.5">Stage</p>
                                        {deal?.lead_stage ? (
                                            <span className="inline-flex items-center gap-1.5 text-[13px]">
                                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: deal.lead_stage.label_color || "#3b82f6" }} />
                                                {td(deal.lead_stage.name, { source: "en" })}
                                            </span>
                                        ) : (
                                            <p className="text-[13px] text-slate-400 mb-0">--</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Participants */}
                    <div className="rounded-xl border border-slate-100 overflow-hidden">
                        <div className="flex items-start gap-3 px-4 py-3">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-24 shrink-0 mt-0.5">
                                Participants{participantUsers.length > 0 && ` · ${participantUsers.length}`}
                            </span>
                            {participantUsers.length > 0 ? (
                                <div className="flex flex-wrap gap-x-4 gap-y-2">
                                    {participantUsers.map((u) => (
                                        <span key={u.id} className="inline-flex items-center gap-2 text-[13px] font-medium text-slate-800">
                                            <Avatar
                                                size={22}
                                                src={u.image_url || u.image}
                                                icon={<UserOutlined />}
                                                className="flex-shrink-0"
                                            />
                                            {u.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-[13px] text-slate-400">--</span>
                            )}
                        </div>
                    </div>

                    {/* Client Attendance — manually recorded/confirmed, never inferred */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Client Attendance</p>
                        {canEditAttendance && meetingHasStarted ? (
                        <div className="flex items-center gap-2">
                            <Button
                                size="small"
                                disabled={attendanceSaving}
                                onClick={() => handleSetAttendance(true)}
                                className={`rounded-lg text-[13px] shadow-none ${attendance === true ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}
                            >
                                ✓ Attended
                            </Button>
                            <Button
                                size="small"
                                disabled={attendanceSaving}
                                onClick={() => handleSetAttendance(false)}
                                className={`rounded-lg text-[13px] shadow-none ${attendance === false ? "bg-red-50 text-red-700 border-red-200" : ""}`}
                            >
                                ✗ No-show
                            </Button>
                            {attendance === null || attendance === undefined ? (
                                <span className="text-[12px] text-slate-400">Not yet confirmed</span>
                            ) : null}
                        </div>
                        ) : (
                        <div className="text-[13px] text-slate-600">
                            {attendance === true && "Attended"}
                            {attendance === false && "No-show"}
                            {(attendance === null || attendance === undefined) && (
                                <span className="text-slate-400">
                                    {canEditAttendance && !meetingHasStarted
                                        ? "Available after the meeting time"
                                        : "Not yet confirmed"}
                                </span>
                            )}
                        </div>
                        )}
                    </div>

                    {/* Meeting Summary */}
                    {followup?.meeting_summary && Object.keys(followup.meeting_summary.summary_object).length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Meeting Summary</p>
                            <div className="rounded-xl border border-slate-100 px-4 py-3 space-y-3">
                                {Object.entries(followup.meeting_summary.summary_object).map(([key, value]) => (
                                    <div key={key}>
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
                                            {key.replace(/[_-]/g, " ")}
                                        </span>
                                        <p className="text-[13px] text-slate-700 leading-relaxed mb-0">{td(String(value), { source: "en" })}</p>
                                    </div>
                                ))}
                                <p className="text-[11px] text-slate-300 mt-2 mb-0">
                                    Generated {formatDateTime(followup.meeting_summary.created_at, { separator: " at " })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Agenda & Remarks */}
                    {followup?.remark && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2.5">Agenda & Remarks</p>
                            <div className="rounded-xl border border-slate-100 px-4 py-3">
                                <ContentRenderer
                                    content={td(followup.remark)}
                                    showFullContent={true}
                                    className="prose prose-sm max-w-none text-[13px] text-slate-700"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="shrink-0 px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {isCreator && followup?.status === "scheduled" && (
                            <Button
                                icon={<ScheduleOutlined />}
                                onClick={() => setRescheduleOpen(true)}
                                disabled={live}
                                className="rounded-lg text-[13px] shadow-none"
                            >
                                Reschedule
                            </Button>
                        )}
                    </div>
                    <Button
                        type="primary"
                        onClick={() => onClose()}
                        className="rounded-lg shadow-none bg-blue-600 border-blue-600 hover:bg-blue-700"
                    >
                        Done
                    </Button>
                </div>
            </Modal>

            {/* Reschedule Modal */}
            {rescheduleOpen && followup && (
                <RescheduleModal
                    open={rescheduleOpen}
                    onClose={() => setRescheduleOpen(false)}
                    followup={followup}
                />
            )}
        </>
    );
};

export default ViewFollowup;
