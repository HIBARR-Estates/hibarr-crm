import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import useTranslation from "@/Hooks/useTranslation";
import { usePage } from "@inertiajs/react";
import {
    App,
    Form,
    Input,
    Button,
    DatePicker,
    TimePicker,
    InputNumber,
    Space,
    Typography,
    Alert,
    Select,
} from "antd";
import {
    CalendarOutlined,
    ClockCircleOutlined,
    SaveOutlined,
    LinkOutlined,
    PlusOutlined,
    DeleteOutlined,
    VideoCameraOutlined,
    PhoneOutlined,
    BankOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    companyDateDayjsFormat,
    companyTimeDayjsFormat,
} from "@/lib/companyDateTime";
import { useState, useEffect } from "react";
import HtmlEditor from "@/Components/HtmlEditor";
import MeetingTypeSelector from "./MeetingTypeSelector";
import FormDataSelector from "@/Components/FormDataSelector";

export interface SaveFollowupFormData {
    lead_id?: number;
    deal_id?: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    duration?: number | null;
    reminders: Reminder[];
    remark?: string;
    timezone?: string;
    participants?: number[];
}

export type SaveFollowupContext = "lead" | "deal";

interface Props {
    context: SaveFollowupContext;
    deal?: Deal;
    lead?: Lead;
    dealsForLead?: { id: number; name: string }[];
    showLeadEntity?: boolean;
    showOptionalDealSelect?: boolean;
    followup?: DealFollowup;
    onSubmit: (data: SaveFollowupFormData) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
    formId?: string;
    hideFooter?: boolean;
    onMeetingTypeNameChange?: (name: string) => void;
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                {label}
            </span>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    );
}

// ─── Duration chip selector ────────────────────────────────────────────────────

const DURATION_OPTIONS = [
    { value: 15,  label: "15 min"  },
    { value: 30,  label: "30 min"  },
    { value: 45,  label: "45 min"  },
    { value: 60,  label: "1 hr"    },
    { value: 90,  label: "1.5 hrs" },
    { value: 120, label: "2 hrs"   },
    { value: 180, label: "3 hrs"   },
    { value: 240, label: "4 hrs"   },
    { value: 360, label: "6 hrs"   },
    { value: 480, label: "8 hrs"   },
];

function DurationChips({
    value,
    onChange,
    disabled,
}: {
    value?: number | null;
    onChange?: (v: number | undefined) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange?.(active ? undefined : opt.value)}
                        className={`px-3 py-1.5 rounded-md text-[13px] font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            active
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-gray-300 text-gray-600 bg-white hover:border-blue-400 hover:text-blue-500"
                        }`}
                    >
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Platform chip selector ────────────────────────────────────────────────────

const PLATFORM_OPTIONS = [
    { value: "zoho",     label: "Video",    icon: <VideoCameraOutlined /> },
    { value: "office",   label: "Office",   icon: <BankOutlined /> },
    { value: "phone",    label: "Phone",    icon: <PhoneOutlined /> },
    { value: "physical", label: "In-Person",icon: <EnvironmentOutlined /> },
];

function PlatformChips({
    value,
    onChange,
    disabled,
    onAfterChange,
}: {
    value?: string;
    onChange?: (v: string) => void;
    disabled?: boolean;
    onAfterChange?: (v: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2">
            {PLATFORM_OPTIONS.map((opt) => {
                const active = value === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                            onChange?.(opt.value);
                            onAfterChange?.(opt.value);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            active
                                ? "bg-blue-500 border-blue-500 text-white"
                                : "border-gray-300 text-gray-600 bg-white hover:border-blue-400 hover:text-blue-500"
                        }`}
                    >
                        {opt.icon}
                        {opt.label}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SaveFollowup({
    context,
    deal,
    lead,
    dealsForLead = [],
    showLeadEntity = false,
    showOptionalDealSelect = false,
    followup,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
    formId,
    hideFooter = false,
    onMeetingTypeNameChange,
}: Props) {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const { props } = usePage<any>();
    const currentUserId: number | undefined = props?.auth?.user?.id;
    const [form] = Form.useForm();
    const [generatingMeetingLink, setGeneratingMeetingLink] = useState(false);

    const handleCancel = () => {
        if (!followup) {
            form.resetFields();
            form.setFieldsValue({ location: "zoho", reminders: [] });
        }
        onCancel();
    };

    const isEditing = !!followup;
    const isScheduled = !!(
        followup &&
        followup.status &&
        ["scheduled", "completed", "cancelled"].includes(followup.status)
    );

    const DEFAULT_REMINDERS: Reminder[] = [
        { time: 1,  type: "hour",   is_default: true },
        { time: 30, type: "minute", is_default: true },
        { time: 15, type: "minute", is_default: true },
        { time: 5,  type: "minute", is_default: true },
    ];

    const formatDefaultReminders = () =>
        DEFAULT_REMINDERS.map((r) => {
            const unit =
                r.type === "hour"
                    ? r.time === 1 ? "hour" : "hours"
                    : r.type === "minute"
                    ? r.time === 1 ? "minute" : "minutes"
                    : r.type === "day"
                    ? r.time === 1 ? "day" : "days"
                    : r.type;
            return `${r.time} ${unit}`;
        }).join(", ");

    const handleGenerateMeetingLink = async () => {
        if (!followup?.id) return;
        setGeneratingMeetingLink(true);
        try {
            const response = await fetch(route("deals.generate-meeting-link"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") || "",
                },
                body: JSON.stringify({ followup_id: followup.id }),
            });
            const data = await response.json();
            if (data.status === "success") {
                form.setFieldValue("meeting_link", data.data.meeting_link);
            }
        } catch {
            // silently fail
        } finally {
            setGeneratingMeetingLink(false);
        }
    };

    const reminderTypes = [
        { value: "minute", label: "Minutes" },
        { value: "hour",   label: "Hours"   },
        { value: "day",    label: "Days"    },
    ];

    const getDefaultParticipants = (): number[] => {
        const ids: number[] = [];
        if (currentUserId) ids.push(currentUserId);
        if (deal?.deal_participants?.length) {
            deal.deal_participants.forEach((p: { id?: number }) => {
                if (p.id && !ids.includes(p.id)) ids.push(p.id);
            });
        }
        if (deal?.deal_watchers?.length) {
            deal.deal_watchers.forEach((w: { id?: number }) => {
                if (w.id && !ids.includes(w.id)) ids.push(w.id);
            });
        }
        if (ids.length === 1 && lead?.lead_owner?.id && !ids.includes(lead.lead_owner.id)) {
            ids.push(lead.lead_owner.id);
        }
        return ids;
    };

    useEffect(() => {
        if (followup) {
            const followupDate = dayjs(followup.next_follow_up_date);
            const existingCustomReminders = followup.reminders
                ? followup.reminders.filter((r: Reminder) => !r.is_default)
                : [];
            form.setFieldsValue({
                next_follow_up_date: followupDate,
                start_time:          followupDate,
                meeting_type_id:     followup.meeting_type?.id,
                location:            followup.location || "zoho",
                meeting_link:        followup.meeting_link || "",
                duration:            followup.duration ?? undefined,
                reminders:           existingCustomReminders,
                remark:              followup.remark || "",
                participants:        followup.participants || [],
            });
        } else {
            const defaultParticipants = getDefaultParticipants();
            form.resetFields();
            form.setFieldsValue({
                location:     "zoho",
                duration:     15,
                reminders:    [],
                participants: defaultParticipants,
            });
        }
    }, [followup, form, deal, lead]);

    const handleLocationChange = (value: string) => {
        if (value !== "zoho") {
            form.setFieldValue("meeting_link", "");
        }
    };

    const handleSubmit = (values: any) => {
        if (isScheduled) return;

        if (context === "deal" && deal) {
            const hasAgent =
                deal.agent_id != null ||
                (deal.lead_agent != null && deal.lead_agent?.id != null);
            if (!hasAgent) {
                message.warning(
                    "This deal has no agent assigned. Please assign an agent to the deal before booking a meeting.",
                );
                return;
            }
        }

        if (context === "lead" && lead && !lead.lead_owner?.id) {
            const optionalDealId = values.optional_deal_id;
            if (!optionalDealId) {
                message.warning(t("app.meetings.lead_owner_required"));
                return;
            }
        }

        const isVideoMeeting = values.location === "zoho";
        const participants = values.participants || [];

        if (isVideoMeeting && participants.length === 0) {
            form.setFields([
                {
                    name: "participants",
                    errors: ["At least one participant is required for video meetings"],
                },
            ]);
            return;
        }

        const customReminders = values.reminders || [];
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

        const formData: SaveFollowupFormData = {
            next_follow_up_date: values.next_follow_up_date.format("DD-MM-YYYY"),
            start_time:          values.start_time.format("HH:mm:ss"),
            meeting_type_id:     values.meeting_type_id,
            location:            values.location,
            meeting_link:        values.meeting_link || "",
            duration:            values.duration ?? null,
            reminders:           customReminders,
            remark:              values.remark || "",
            participants:        participants,
            timezone:            browserTimezone,
            ...(values.duration ? { duration: values.duration } : {}),
        };

        if (context === "lead" && lead) {
            formData.lead_id = lead.id;
            if (values.optional_deal_id) {
                formData.deal_id = values.optional_deal_id;
            }
        } else if (context === "deal" && deal) {
            formData.deal_id = deal.id;
        }

        onSubmit(formData);

        if (!isEditing) {
            form.resetFields();
            const defaultParticipants = getDefaultParticipants();
            form.setFieldsValue({
                location:     "zoho",
                reminders:    [],
                participants: defaultParticipants,
            });
        }
    };

    return (
        <Form
            id={formId}
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="flex flex-col gap-y-4"
        >
            {/* Errors */}
            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    {errors.map((error, i) => (
                        <p key={i} className="text-red-600 text-sm mb-0">{error}</p>
                    ))}
                </div>
            )}

            {/* Lead entity info */}
            {showLeadEntity && lead && (
                <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-xs font-medium text-gray-500 mb-1">
                        {t("app.meetings.linked_lead_label")}
                    </p>
                    <p className="text-sm font-medium text-gray-900 mb-0">
                        {lead.client_name_salutation || lead.client_name}
                    </p>
                </div>
            )}

            {/* Optional deal select */}
            {showOptionalDealSelect && (
                <Form.Item
                    name="optional_deal_id"
                    label={t("app.meetings.optional_deal_label")}
                >
                    <Select
                        showSearch
                        allowClear
                        placeholder={t("app.meetings.optional_deal_placeholder")}
                        optionFilterProp="label"
                        className="w-full"
                        disabled={loading || isScheduled}
                        options={dealsForLead.map((d) => ({ value: d.id, label: d.name }))}
                        filterOption={(input, option) =>
                            (option?.label as string)?.toLowerCase().includes(input.toLowerCase()) ?? false
                        }
                    />
                </Form.Item>
            )}

            {/* ── Date & Time ── */}
            <SectionDivider label="Date & Time" />

            <div className="grid grid-cols-2 gap-4">
                <Form.Item
                    name="next_follow_up_date"
                    label="Meeting Date"
                    rules={[{ required: true, message: "Please select a meeting date" }]}
                    className="mb-0"
                >
                    <DatePicker
                        className="w-full"
                        format={companyDateDayjsFormat()}
                        disabled={loading || isScheduled}
                        disabledDate={(current) => current && current < dayjs().startOf("day")}
                        prefix={<CalendarOutlined />}
                        placeholder="Select date"
                    />
                </Form.Item>

                <Form.Item
                    name="start_time"
                    label="Start Time"
                    rules={[
                        { required: true, message: "Please select a start time" },
                        {
                            validator: (_, value) => {
                                const selectedDate = form.getFieldValue("next_follow_up_date");
                                if (!value || !selectedDate) return Promise.resolve();
                                if (!dayjs.isDayjs(selectedDate) || !dayjs.isDayjs(value)) return Promise.resolve();
                                const selectedDateTime = dayjs(selectedDate)
                                    .hour(value.hour())
                                    .minute(value.minute())
                                    .second(0)
                                    .millisecond(0);
                                if (selectedDateTime.isBefore(dayjs().add(5, "minute"))) {
                                    return Promise.reject(new Error("Start time must be at least 5 minutes in the future."));
                                }
                                return Promise.resolve();
                            },
                        },
                    ]}
                    className="mb-0"
                >
                    <TimePicker
                        className="w-full"
                        format={companyTimeDayjsFormat()}
                        disabled={loading || isScheduled}
                        prefix={<ClockCircleOutlined />}
                        placeholder="Select time"
                    />
                </Form.Item>
            </div>

            {/* ── Meeting Details ── */}
            <SectionDivider label="Meeting Details" />

            {/* Duration */}
            <Form.Item
                name="duration"
                label="Duration"
                tooltip="Meeting duration in minutes"
                className="mb-0"
            >
                <DurationChips disabled={loading || isScheduled} />
            </Form.Item>

            {/* Meeting Type */}
            <Form.Item
                name="meeting_type_id"
                label="Meeting Type"
                rules={[{ required: true, message: "Please select a meeting type" }]}
                className="mb-0"
            >
                <MeetingTypeSelector
                    renderAsChips={true}
                    disabled={loading || isScheduled}
                    placeholder="Select meeting type"
                    showPlatform={false}
                    onNameChange={onMeetingTypeNameChange}
                />
            </Form.Item>

            {/* Platform */}
            <Form.Item
                name="location"
                label="Platform"
                rules={[{ required: true, message: "Please select a platform" }]}
                className="mb-0"
            >
                <PlatformChips
                    disabled={loading || isScheduled}
                    onAfterChange={handleLocationChange}
                />
            </Form.Item>

            {/* Meeting Link — only for video */}
            <Form.Item
                shouldUpdate={(prev, curr) =>
                    prev.location !== curr.location || prev.meeting_link !== curr.meeting_link
                }
                noStyle
            >
                {({ getFieldValue }) => {
                    const loc = getFieldValue("location");
                    if (loc !== "zoho") return null;
                    const link = getFieldValue("meeting_link");
                    const showGenerate = loc === "zoho" && !link && isEditing;

                    return (
                        <Form.Item
                            name="meeting_link"
                            label={
                                <Space>
                                    Meeting Link
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                        (Auto-generated for video)
                                    </Typography.Text>
                                </Space>
                            }
                            rules={[
                                {
                                    type: "url",
                                    validator: (_, value) => {
                                        if (!value) return Promise.resolve();
                                        try { new URL(value); return Promise.resolve(); }
                                        catch { return Promise.reject(new Error("Please enter a valid URL")); }
                                    },
                                },
                            ]}
                            className="mb-0"
                        >
                            <Space.Compact style={{ display: "flex" }}>
                                <Input
                                    placeholder="Meeting link will be auto-generated"
                                    disabled={loading || (loc === "zoho" && !isEditing) || isScheduled}
                                    readOnly={loc === "zoho" || isScheduled}
                                    style={{ flex: 1 }}
                                />
                                {showGenerate && (
                                    <Button
                                        type="primary"
                                        icon={<LinkOutlined />}
                                        loading={generatingMeetingLink}
                                        onClick={handleGenerateMeetingLink}
                                        disabled={loading || isScheduled}
                                    >
                                        Generate
                                    </Button>
                                )}
                            </Space.Compact>
                        </Form.Item>
                    );
                }}
            </Form.Item>

            {/* ── People ── (only for video meetings) */}
            <Form.Item
                shouldUpdate={(prev, curr) => prev.location !== curr.location}
                noStyle
            >
                {({ getFieldValue }) => {
                    if (getFieldValue("location") !== "zoho") return null;
                    return (
                        <>
                            <SectionDivider label="People" />
                            <Form.Item
                                name="participants"
                                label="Meeting Participants"
                                rules={[
                                    {
                                        validator: (_, value) => {
                                            if (!value || value.length === 0) {
                                                return Promise.reject(
                                                    new Error("At least one participant is required for video meetings"),
                                                );
                                            }
                                            return Promise.resolve();
                                        },
                                    },
                                ]}
                                tooltip="Pre-filled with deal agent, participants, and watchers."
                                className="mb-0"
                            >
                                <FormDataSelector
                                    type="employees"
                                    mode="multiple"
                                    placeholder="Select meeting participants"
                                    disabled={loading || isScheduled}
                                />
                            </Form.Item>
                        </>
                    );
                }}
            </Form.Item>

            {/* ── Optional ── */}
            <SectionDivider label="Optional" />

            {/* Agenda */}
            <Form.Item label="Meeting Agenda" name="remark" className="mb-0">
                <HtmlEditor
                    placeholder="Enter meeting agenda, details, or remarks..."
                    disabled={loading || isScheduled}
                    height={200}
                />
            </Form.Item>

            {/* Reminders — info block + custom */}
            <div className="space-y-3">
                <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <ClockCircleOutlined className="text-blue-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-blue-800 mb-0">
                            Automatic reminders included
                        </p>
                        <p className="text-[13px] text-blue-600 mt-0.5 mb-0">
                            Participants will be notified {formatDefaultReminders()} before the meeting.
                        </p>
                    </div>
                </div>

                <div>
                    <Typography.Text strong className="text-sm block mb-2">
                        Additional Custom Reminders (Optional):
                    </Typography.Text>

                    <Form.List name="reminders">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.length > 0 && (
                                    <div className="flex flex-col gap-y-2 mb-2">
                                        {fields.map((field) => (
                                            <div
                                                key={field.key}
                                                className="p-3 border border-gray-200 rounded-lg bg-white"
                                            >
                                                <Space className="w-full" align="center">
                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, "time"]}
                                                        className="mb-0"
                                                        rules={[
                                                            { required: true, message: "Enter time" },
                                                            { type: "number", min: 1, max: 1440, message: "1–1440" },
                                                        ]}
                                                    >
                                                        <InputNumber
                                                            min={1}
                                                            max={1440}
                                                            placeholder="15"
                                                            disabled={loading || isScheduled}
                                                            style={{ width: 80 }}
                                                        />
                                                    </Form.Item>

                                                    <Form.Item
                                                        {...field}
                                                        name={[field.name, "type"]}
                                                        className="mb-0"
                                                        rules={[{ required: true, message: "Select unit" }]}
                                                    >
                                                        <Select
                                                            placeholder="Unit"
                                                            disabled={loading || isScheduled}
                                                            style={{ width: 100 }}
                                                            options={reminderTypes}
                                                        />
                                                    </Form.Item>

                                                    <Form.Item label={null}>
                                                        <Typography.Text type="secondary">
                                                            before meeting
                                                        </Typography.Text>
                                                    </Form.Item>

                                                    <Form.Item label={null}>
                                                        <Button
                                                            type="text"
                                                            danger
                                                            icon={<DeleteOutlined />}
                                                            onClick={() => remove(field.name)}
                                                            disabled={loading || isScheduled}
                                                            size="small"
                                                        />
                                                    </Form.Item>
                                                </Space>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <Button
                                    type="dashed"
                                    onClick={() => add({ time: 10, type: "minute" })}
                                    icon={<PlusOutlined />}
                                    className="w-full"
                                    disabled={loading || isScheduled}
                                    size="small"
                                >
                                    Add Custom Reminder
                                </Button>
                            </>
                        )}
                    </Form.List>
                </div>
            </div>

            {/* Footer (hidden when managed externally) */}
            {!hideFooter && (
                <div className="flex items-center justify-end gap-x-3 mt-8 mb-4 pt-4 border-t border-gray-200">
                    <Button onClick={handleCancel} disabled={loading || isScheduled}>
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        disabled={loading || isScheduled}
                        icon={<SaveOutlined />}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {isEditing ? "Update Meeting" : "Schedule Meeting"}
                    </Button>
                </div>
            )}
        </Form>
    );
}
