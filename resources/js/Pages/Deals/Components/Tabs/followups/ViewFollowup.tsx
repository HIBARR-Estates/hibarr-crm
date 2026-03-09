import React, { useState } from "react";
import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import {
    Drawer,
    Tag,
    Tooltip,
    Button,
    Modal,
    DatePicker,
    TimePicker,
    InputNumber,
    Form,
    Avatar,
} from "antd";
import {
    CalendarOutlined,
    EditOutlined,
    EnvironmentOutlined,
    UserOutlined,
    VideoCameraOutlined,
    TeamOutlined,
    PhoneOutlined,
    FileTextOutlined,
    ThunderboltOutlined,
    ScheduleOutlined,
    FundProjectionScreenOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { usePage, router } from "@inertiajs/react";
import { ContentRenderer } from "@/Components/ContentRenderer";
import MultiUserIndicator from "@/Components/MultiUserIndicator";

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
                            format="YYYY-MM-DD"
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
                        <TimePicker className="w-full" format="HH:mm" />
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
    <div className={className}>
        <div className="flex items-center gap-1.5 mb-3">
            {icon && <span className="text-xs opacity-60">{icon}</span>}
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
    deal: Deal;
    followup: DealFollowup;
    onEdit?: () => void;
}

const ViewFollowup: React.FC<Props> = ({
    deal,
    followup,
    onClose,
    open,
    onEdit,
}) => {
    const { props } = usePage<any>();
    const currentUserId = props?.auth?.user?.id;
    const [rescheduleOpen, setRescheduleOpen] = useState(false);

    const live = isLiveMeeting(followup);
    const elapsedMinutes = getElapsedMinutes(followup);
    const localDate = dayjs.utc(followup?.next_follow_up_date).local();
    const effectiveDuration =
        followup?.effective_duration ?? followup?.duration ?? DEFAULT_DURATION;
    const isCreator = followup?.added_by?.id === currentUserId;
    const hasValidLink =
        followup?.meeting_link &&
        isSafeUrl(followup.meeting_link) &&
        !["office", "phone", "physical"].includes(followup?.location);

    const participantUsers = followup?.participant_users ?? [];
    const isNonVideoLocation = ["office", "phone", "physical"].includes(
        followup?.location,
    );

    const meetingTitle = followup?.meeting_type?.name || "Follow-up Meeting";

    const handleEdit = () => {
        onClose();
        if (onEdit) onEdit();
    };

    return (
        <>
            <Drawer
                title={
                    <div className="flex flex-col gap-1.5">
                        {/* Tags row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {followup?.meeting_type && (
                                <Tag
                                    bordered={false}
                                    className="text-[11px] m-0 rounded-full px-2 bg-blue-50 text-blue-600"
                                >
                                    {followup.meeting_type.name}
                                </Tag>
                            )}
                            {live && (
                                <Tag
                                    bordered={false}
                                    className="text-[11px] m-0 rounded-full px-2 bg-red-50 text-red-600 animate-pulse"
                                >
                                    <ThunderboltOutlined className="mr-0.5" />
                                    Live
                                </Tag>
                            )}
                            <Tag
                                bordered={false}
                                className={`text-[11px] m-0 rounded-full px-2 capitalize ${
                                    live
                                        ? "bg-red-50 text-red-600"
                                        : followup?.status === "scheduled"
                                          ? "bg-amber-50 text-amber-600"
                                          : followup?.status === "completed"
                                            ? "bg-emerald-50 text-emerald-600"
                                            : "bg-gray-100 text-gray-500"
                                }`}
                            >
                                {live ? "In Progress" : followup?.status}
                            </Tag>
                        </div>
                        {/* Title row */}
                        <div className="flex items-center justify-between">
                            <Tooltip title={meetingTitle}>
                                <span className="text-base font-semibold text-gray-900 truncate max-w-[320px] block leading-tight">
                                    {meetingTitle}
                                </span>
                            </Tooltip>
                            {onEdit && (
                                <Tooltip title="Edit">
                                    <button
                                        onClick={handleEdit}
                                        className="text-gray-400 hover:text-gray-700 transition-colors p-1 -mr-1"
                                    >
                                        <EditOutlined className="text-sm" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    </div>
                }
                placement="right"
                size="large"
                open={open}
                onClose={() => onClose()}
                destroyOnHidden
                className="view-followup-drawer"
                styles={{
                    body: { padding: "20px 24px" },
                    header: {
                        borderBottom: "1px solid #f3f4f6",
                    },
                }}
            >
                <div className="space-y-6">
                    {/* ── Meeting Details ──────────────────────────────── */}
                    <Section title="Details" icon={<CalendarOutlined />}>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <DetailField label="Date">
                                {localDate.format("MMM DD, YYYY")}
                            </DetailField>
                            <DetailField label="Time">
                                {localDate.format("h:mm A")}
                            </DetailField>
                            <DetailField label="Platform">
                                <span className="inline-flex items-center gap-1.5">
                                    {getMeetingIcon(followup?.location || "")}
                                    {getLocationLabel(
                                        followup?.location || "office",
                                    )}
                                </span>
                            </DetailField>
                            <DetailField label="Duration">
                                <span className="inline-flex items-center gap-1.5">
                                    {effectiveDuration} min
                                    {live && elapsedMinutes !== null && (
                                        <span className="text-[11px] text-red-500 font-medium">
                                            ({elapsedMinutes}m elapsed)
                                        </span>
                                    )}
                                </span>
                            </DetailField>
                            <DetailField label="Scheduled by">
                                {followup?.added_by ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Avatar
                                            size={18}
                                            src={followup.added_by.image_url}
                                            icon={<UserOutlined />}
                                            className="flex-shrink-0"
                                        />
                                        {followup.added_by.name}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </DetailField>
                        </div>
                    </Section>

                    <div className="border-t border-gray-100" />

                    {/* ── Deal Information ─────────────────────────────── */}
                    <Section
                        title="Deal"
                        icon={<FundProjectionScreenOutlined />}
                    >
                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                            <DetailField label="Name">
                                {deal?.name ? (
                                    <a
                                        href={`/account/deals/${deal.id}`}
                                        className="text-gray-900 hover:text-blue-600 transition-colors font-medium"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            router.visit(
                                                `/account/deals/${deal.id}`,
                                            );
                                        }}
                                    >
                                        {deal.name}
                                    </a>
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </DetailField>
                            <DetailField label="Value">
                                {deal?.value ? (
                                    <span className="font-medium tabular-nums">
                                        {deal?.currency?.currency_symbol || "$"}
                                        {Number(deal.value).toLocaleString()}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </DetailField>
                            <DetailField label="Stage">
                                {deal?.lead_stage ? (
                                    <span className="inline-flex items-center gap-1.5 text-[13px]">
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{
                                                backgroundColor:
                                                    deal.lead_stage
                                                        .label_color ||
                                                    "#3b82f6",
                                            }}
                                        />
                                        {deal.lead_stage.name}
                                    </span>
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </DetailField>
                            {deal?.contact && (
                                <DetailField label="Client">
                                    {deal.contact.client_name}
                                </DetailField>
                            )}
                        </div>
                    </Section>

                    <div className="border-t border-gray-100" />

                    {/* ── Participants ─────────────────────────────────── */}
                    <Section title="Participants" icon={<TeamOutlined />}>
                        {participantUsers.length > 0 ? (
                            <MultiUserIndicator
                                users={participantUsers}
                                size="sm"
                                maxCount={8}
                                showNames={true}
                                direction="vertical"
                            />
                        ) : (
                            <p className="text-[13px] text-gray-400 italic mb-0">
                                No participants listed
                            </p>
                        )}
                    </Section>

                    {/* ── Meeting Summary ──────────────────────────────── */}
                    {followup?.meeting_summary && (
                        <>
                            <div className="border-t border-gray-100" />
                            <Section
                                title="Meeting Summary"
                                icon={<FileTextOutlined />}
                            >
                                {Object.keys(
                                    followup.meeting_summary.summary_object,
                                ).length > 0 ? (
                                    <div className="space-y-4">
                                        {Object.entries(
                                            followup.meeting_summary
                                                .summary_object,
                                        ).map(([key, value]) => (
                                            <div key={key}>
                                                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block mb-1">
                                                    {key.replace(/[_-]/g, " ")}
                                                </span>
                                                <p className="text-[13px] text-gray-700 leading-relaxed mb-0">
                                                    {value}
                                                </p>
                                            </div>
                                        ))}
                                        <p className="text-[11px] text-gray-300 mt-3 mb-0">
                                            Generated{" "}
                                            {dayjs(
                                                followup.meeting_summary
                                                    .created_at,
                                            ).format(
                                                "MMM DD, YYYY [at] h:mm A",
                                            )}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[13px] text-gray-400 italic mb-0">
                                        Summary recorded but contains no data
                                    </p>
                                )}
                            </Section>
                        </>
                    )}

                    {/* ── Remarks / Agenda ─────────────────────────────── */}
                    {followup?.remark && (
                        <>
                            <div className="border-t border-gray-100" />
                            <Section
                                title="Agenda & Remarks"
                                icon={<FileTextOutlined />}
                            >
                                <ContentRenderer
                                    content={followup.remark}
                                    showFullContent={true}
                                    className="prose prose-sm max-w-none text-[13px] text-gray-700"
                                />
                            </Section>
                        </>
                    )}

                    {/* ── Actions (Meeting Link + Reschedule) ──────────── */}
                    {(hasValidLink ||
                        !isNonVideoLocation ||
                        (isCreator && followup?.status === "scheduled")) && (
                        <>
                            <div className="border-t border-gray-100" />
                            <div className="flex items-center gap-2 flex-wrap">
                                {hasValidLink && (
                                    <Button
                                        type="primary"
                                        icon={getMeetingIcon(
                                            followup?.location || "",
                                        )}
                                        href={followup.meeting_link}
                                        size="small"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-gray-900 hover:bg-gray-800 border-gray-900 rounded-md text-[13px] shadow-none"
                                    >
                                        Join Meeting
                                    </Button>
                                )}
                                {!hasValidLink && !isNonVideoLocation && (
                                    <span className="text-[13px] text-gray-400">
                                        No meeting link
                                    </span>
                                )}
                                {isCreator &&
                                    followup?.status === "scheduled" && (
                                        <Button
                                            icon={<ScheduleOutlined />}
                                            onClick={() =>
                                                setRescheduleOpen(true)
                                            }
                                            disabled={live}
                                            size="small"
                                            className="rounded-md text-[13px] shadow-none"
                                        >
                                            Reschedule
                                        </Button>
                                    )}
                            </div>
                        </>
                    )}
                </div>
            </Drawer>

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
