import React, { useState } from "react";
import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import {
    Drawer,
    Typography,
    Tag,
    Tooltip,
    Button,
    Modal,
    DatePicker,
    TimePicker,
    InputNumber,
    Form,
    Divider,
    Avatar,
} from "antd";
import {
    CalendarOutlined,
    EditOutlined,
    EnvironmentOutlined,
    LinkOutlined,
    UserOutlined,
    VideoCameraOutlined,
    TeamOutlined,
    PhoneOutlined,
    FileTextOutlined,
    ClockCircleOutlined,
    ThunderboltOutlined,
    ScheduleOutlined,
    DollarOutlined,
    FundProjectionScreenOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { usePage, router } from "@inertiajs/react";
import { ContentRenderer } from "@/Components/ContentRenderer";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { getStatusColor } from "@/lib/utils";

dayjs.extend(utc);

const { Title, Text } = Typography;

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

// ─── Section Card ────────────────────────────────────────────────────────────

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
    <div
        className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}
    >
        <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-0 flex items-center gap-2">
                {icon}
                {title}
            </h3>
        </div>
        <div className="p-4">{children}</div>
    </div>
);

// ─── Detail Row ──────────────────────────────────────────────────────────────

const DetailRow: React.FC<{
    label: string;
    children: React.ReactNode;
}> = ({ label, children }) => (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-b-0">
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium min-w-[100px]">
            {label}
        </span>
        <span className="text-sm text-gray-800 text-right">{children}</span>
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
                    <div className="flex flex-col gap-1">
                        {/* Tags row */}
                        <div className="flex items-center gap-2 flex-wrap">
                            {followup?.meeting_type && (
                                <Tag color="blue" className="text-xs m-0">
                                    {followup.meeting_type.name}
                                </Tag>
                            )}
                            {live && (
                                <Tag
                                    color="red"
                                    className="text-xs m-0 animate-pulse"
                                >
                                    <ThunderboltOutlined className="mr-1" />
                                    Live
                                </Tag>
                            )}
                            <Tag
                                color={
                                    live
                                        ? "red"
                                        : getStatusColor(followup?.status)
                                }
                                className="text-xs m-0 capitalize"
                            >
                                {live ? "In Progress" : followup?.status}
                            </Tag>
                        </div>
                        {/* Title row */}
                        <div className="flex items-center justify-between">
                            <Tooltip title={meetingTitle}>
                                <span className="text-base font-semibold truncate max-w-[320px] block">
                                    {meetingTitle}
                                </span>
                            </Tooltip>
                            {onEdit && (
                                <Tooltip title="Edit Meeting">
                                    <EditOutlined
                                        className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm"
                                        onClick={handleEdit}
                                    />
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
            >
                <div className="space-y-5">
                    {/* ── Meeting Details ──────────────────────────────── */}
                    <Section
                        title="Meeting Details"
                        icon={<CalendarOutlined className="text-blue-600" />}
                    >
                        <div className="space-y-0">
                            <DetailRow label="Date">
                                {localDate.format("MMMM DD, YYYY")}
                            </DetailRow>
                            <DetailRow label="Time">
                                {localDate.format("h:mm A")}
                            </DetailRow>
                            <DetailRow label="Platform">
                                <span className="inline-flex items-center gap-1.5">
                                    {getMeetingIcon(followup?.location || "")}
                                    <span className="capitalize">
                                        {getLocationLabel(
                                            followup?.location || "office",
                                        )}
                                    </span>
                                </span>
                            </DetailRow>
                            <DetailRow label="Scheduled By">
                                {followup?.added_by ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <Avatar
                                            size={20}
                                            src={followup.added_by.image_url}
                                            icon={<UserOutlined />}
                                        />
                                        {followup.added_by.name}
                                    </span>
                                ) : (
                                    <Text type="secondary">--</Text>
                                )}
                            </DetailRow>
                            <DetailRow label="Duration">
                                <span className="inline-flex items-center gap-1.5">
                                    <ClockCircleOutlined className="text-gray-400" />
                                    {effectiveDuration} min
                                    {live && elapsedMinutes !== null && (
                                        <Tag
                                            color="red"
                                            className="text-xs m-0 ml-1"
                                        >
                                            {elapsedMinutes} min elapsed
                                        </Tag>
                                    )}
                                </span>
                            </DetailRow>
                        </div>
                    </Section>

                    {/* ── Deal Information ─────────────────────────────── */}
                    <Section
                        title="Deal"
                        icon={
                            <FundProjectionScreenOutlined className="text-indigo-600" />
                        }
                    >
                        <div className="space-y-0">
                            <DetailRow label="Deal Name">
                                {deal?.name ? (
                                    <a
                                        href={`/account/deals/${deal.id}`}
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
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
                                    <Text type="secondary">--</Text>
                                )}
                            </DetailRow>
                            <DetailRow label="Value">
                                {deal?.value ? (
                                    <span className="font-medium">
                                        {deal?.currency?.currency_symbol || "$"}
                                        {Number(deal.value).toLocaleString()}
                                    </span>
                                ) : (
                                    <Text type="secondary">--</Text>
                                )}
                            </DetailRow>
                            <DetailRow label="Stage">
                                {deal?.lead_stage ? (
                                    <Tag
                                        color={
                                            deal.lead_stage.label_color ||
                                            "blue"
                                        }
                                    >
                                        {deal.lead_stage.name}
                                    </Tag>
                                ) : (
                                    <Text type="secondary">--</Text>
                                )}
                            </DetailRow>
                            {deal?.contact && (
                                <DetailRow label="Client">
                                    {deal.contact.client_name}
                                </DetailRow>
                            )}
                        </div>
                    </Section>

                    {/* ── Participants ─────────────────────────────────── */}
                    <Section
                        title="Participants"
                        icon={<TeamOutlined className="text-green-600" />}
                    >
                        {participantUsers.length > 0 ? (
                            <div className="flex items-center gap-3">
                                <MultiUserIndicator
                                    users={participantUsers}
                                    size="sm"
                                    maxCount={8}
                                    showNames={true}
                                    direction="vertical"
                                />
                            </div>
                        ) : (
                            <Text type="secondary" italic>
                                No participants listed
                            </Text>
                        )}
                    </Section>

                    {/* ── Meeting Summary ──────────────────────────────── */}
                    {followup?.meeting_summary && (
                        <Section
                            title="Meeting Summary"
                            icon={
                                <FileTextOutlined className="text-green-600" />
                            }
                            className="border-green-200"
                        >
                            {Object.keys(
                                followup.meeting_summary.summary_object,
                            ).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(
                                        followup.meeting_summary.summary_object,
                                    ).map(([key, value]) => (
                                        <div
                                            key={key}
                                            className="border-b border-green-50 pb-3 last:border-b-0 last:pb-0"
                                        >
                                            <p className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1">
                                                {key.replace(/[_-]/g, " ")}
                                            </p>
                                            <p className="text-sm text-gray-700 mb-0">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                    <p className="text-xs text-gray-400 mt-2 mb-0">
                                        Generated on{" "}
                                        {dayjs(
                                            followup.meeting_summary.created_at,
                                        ).format("MMM DD, YYYY [at] h:mm A")}
                                    </p>
                                </div>
                            ) : (
                                <Text type="secondary" italic>
                                    Meeting summary is available but contains no
                                    data
                                </Text>
                            )}
                        </Section>
                    )}

                    {/* ── Remarks / Agenda ─────────────────────────────── */}
                    {followup?.remark && (
                        <Section
                            title="Agenda & Remarks"
                            icon={
                                <FileTextOutlined className="text-gray-500" />
                            }
                        >
                            <ContentRenderer
                                content={followup.remark}
                                showFullContent={true}
                                className="prose prose-sm max-w-none"
                            />
                        </Section>
                    )}

                    {/* ── Meeting Link + Reschedule ────────────────────── */}
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
                        {/* Meeting Link */}
                        <div>
                            {hasValidLink ? (
                                <Button
                                    type="primary"
                                    icon={getMeetingIcon(
                                        followup?.location || "",
                                    )}
                                    href={followup.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="bg-blue-600 hover:bg-blue-700"
                                >
                                    Join Meeting
                                </Button>
                            ) : !isNonVideoLocation ? (
                                <Text type="secondary" className="text-sm">
                                    No meeting link available
                                </Text>
                            ) : null}
                        </div>

                        {/* Reschedule Button — only for creator */}
                        {isCreator && followup?.status === "scheduled" && (
                            <Button
                                icon={<ScheduleOutlined />}
                                onClick={() => setRescheduleOpen(true)}
                                disabled={live}
                                size="small"
                            >
                                Reschedule
                            </Button>
                        )}
                    </div>
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
