import { Deal } from "@/Types/api/deals";
import { DealFollowup, Reminder } from "@/Types/api/deal-followup";
import {
    Form,
    Input,
    Button,
    DatePicker,
    TimePicker,
    Select,
    Switch,
    InputNumber,
    Card,
    Space,
    Typography,
    Alert,
} from "antd";
import {
    CalendarOutlined,
    ClockCircleOutlined,
    SaveOutlined,
    LinkOutlined,
    PlusOutlined,
    DeleteOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import HtmlEditor from "@/Components/HtmlEditor";
import MeetingTypeSelector from "./MeetingTypeSelector";

const { TextArea } = Input;
const { Option } = Select;
const { Title } = Typography;

interface SaveFollowupFormData {
    deal_id: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    reminders: Reminder[];
    remark?: string;
}

interface Props {
    deal: Deal;
    followup?: DealFollowup;
    onSubmit: (data: SaveFollowupFormData) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
}

export default function SaveFollowup({
    deal,
    followup,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
}: Props) {
    const [form] = Form.useForm();
    const [generatingMeetingLink, setGeneratingMeetingLink] = useState(false);

    // Reset form when canceling (only for new meetings, not editing)
    const handleCancel = () => {
        if (!followup) {
            form.resetFields();
            form.setFieldsValue({
                location: "zoho",
                reminders: [],
            });
        }
        onCancel();
    };

    const isEditing = !!followup;
    const isScheduled = !!(followup && followup.status && 
        ['scheduled', 'completed', 'cancelled'].includes(followup.status));
    const needsZohoMeetingLink =
        form.getFieldValue("location") === "zoho" &&
        !form.getFieldValue("meeting_link");

    // Default reminders that cannot be edited or deleted
    const DEFAULT_REMINDERS: Reminder[] = [
        { time: 1, type: "hour", is_default: true },
        { time: 30, type: "minute", is_default: true },
        { time: 15, type: "minute", is_default: true },
        { time: 5, type: "minute", is_default: true },
    ];

    // Helper function to format default reminder text
    const formatDefaultReminders = () => {
        return DEFAULT_REMINDERS.map((reminder) => {
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
        }).join(", ");
    };

    // API mutation for generating meeting links
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
            } else {
                console.error("Failed to generate meeting link:", data);
            }
        } catch (error) {
            console.error("Failed to generate meeting link:", error);
        } finally {
            setGeneratingMeetingLink(false);
        }
    };

    // Standard location options
    const standardLocationOptions = [
        { value: "zoho", label: "Video Meeting" },
        { value: "office", label: "HIBARR Office" },
        { value: "phone", label: "Phone Meeting" },
        { value: "physical", label: "Physical Meeting" },
    ];

    // Map old location values to readable labels for backward compatibility
    const oldLocationLabels: Record<string, string> = {
        'zoom': 'Zoom',
        'teams': 'Microsoft Teams',
        'meet': 'Google Meet',
        'phone': 'Phone Call',
        'skype': 'Skype',
        'other': 'Other',
        'zoho_meet': 'Zoho Meet',
        'google_meet': 'Google Meet',
    };

    // Get current location value from form to preserve old values
    const currentLocation = Form.useWatch('location', form);
    
    // Build location options including current value if it's not in standard options
    const locationOptions = (() => {
        const options = [...standardLocationOptions];
        
        // If current location exists and is not in standard options, add it
        if (currentLocation && !options.find(opt => opt.value === currentLocation)) {
            options.push({
                value: currentLocation,
                label: oldLocationLabels[currentLocation] || currentLocation.charAt(0).toUpperCase() + currentLocation.slice(1)
            });
        }
        
        return options;
    })();

    const reminderTypes = [
        { value: "minute", label: "Minutes" },
        { value: "hour", label: "Hours" },
        { value: "day", label: "Days" },
    ];

    // Initialize form with followup data if editing
    useEffect(() => {
        if (followup) {
            const followupDate = dayjs(followup.next_follow_up_date);

            // Get existing custom reminders (exclude defaults) or initialize with empty array
            const existingCustomReminders = followup.reminders
                ? followup.reminders.filter((r: Reminder) => !r.is_default)
                : [];

            form.setFieldsValue({
                next_follow_up_date: followupDate,
                start_time: followupDate,
                meeting_type_id: followup.meeting_type?.id,
                location: followup.location || "zoho",
                meeting_link: followup.meeting_link || "",
                reminders: existingCustomReminders, // Only set custom reminders in form
                remark: followup.remark || "",
            });
        } else {
            // Reset form to default values for new follow-up
            form.resetFields();
            form.setFieldsValue({
                location: "zoho",
                reminders: [], // Start with empty custom reminders array
            });
        }
    }, [followup, form]);

    const handleLocationChange = (value: string) => {
        if (value === "office") {
            form.setFieldValue("meeting_link", "");
        }
        // For Zoho, we'll show the generate button if no link exists
    };

    const handleSubmit = (values: any) => {
        // Prevent submission if meeting is already scheduled
        if (isScheduled) {
            return;
        }

        // Get custom reminders from form
        const customReminders = values.reminders || [];

        const formData: SaveFollowupFormData = {
            next_follow_up_date:
                values.next_follow_up_date.format("DD-MM-YYYY"),
            start_time: values.start_time.format("HH:mm:ss"),
            meeting_type_id: values.meeting_type_id,
            location: values.location,
            meeting_link: values.meeting_link || "",
            reminders: customReminders, // Only send custom reminders, defaults are handled server-side
            remark: values.remark || "",
            deal_id: deal.id,
        };

        onSubmit(formData);
        
        // Reset form after submission if creating new meeting (not editing)
        if (!isEditing) {
            form.resetFields();
            form.setFieldsValue({
                location: "zoho",
                reminders: [],
            });
        }
    };

    // Custom validator for HTML content
    const validateContent = (_: any, value: string) => {
        // Strip HTML tags and check for actual text content
        const textContent = (value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            return Promise.reject(new Error("Please enter follow-up details"));
        }
        return Promise.resolve();
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="flex flex-col gap-y-4"
        >
            {/* Display errors if any */}
            {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                    {errors.map((error, index) => (
                        <p key={index} className="text-red-600 text-sm mb-0">
                            {error}
                        </p>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Follow-up Date */}
                <Form.Item
                    name="next_follow_up_date"
                    label="Meeting Date"
                    rules={[
                        {
                            required: true,
                            message: "Please select a meeting date",
                        },
                    ]}
                >
                    <DatePicker
                        className="w-full"
                        format="YYYY-MM-DD"
                        disabled={loading || isScheduled}
                        disabledDate={(current) =>
                            current && current < dayjs().startOf("day")
                        }
                        prefix={<CalendarOutlined />}
                        placeholder="Select date"
                    />
                </Form.Item>

                {/* Start Time */}
                <Form.Item
                    name="start_time"
                    label="Start Time"
                    rules={[
                        {
                            required: true,
                            message: "Please select a start time",
                        },
                    ]}
                >
                    <TimePicker
                        className="w-full"
                        format="HH:mm"
                        disabled={loading || isScheduled}
                        prefix={<ClockCircleOutlined />}
                        placeholder="Select time"
                    />
                </Form.Item>
            </div>

            {/* Meeting Type */}
            <Form.Item
                name="meeting_type_id"
                label="Meeting Type"
                rules={[
                    {
                        required: true,
                        message: "Please select a meeting type",
                    },
                ]}
            >
                <MeetingTypeSelector
                    disabled={loading || isScheduled}
                    placeholder="Select meeting type"
                    showPlatform={false}
                />
            </Form.Item>

            {/* Location/Platform */}
            <Form.Item
                name="location"
                label="Platform"
                rules={[
                    {
                        required: true,
                        message: "Please select a platform",
                    },
                ]}
            >
                <Select
                    placeholder="Select platform"
                    className="w-full"
                    disabled={loading || isScheduled}
                    onChange={handleLocationChange}
                >
                    {locationOptions.map((option) => (
                        <Option key={option.value} value={option.value}>
                            {option.label}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            {/* Meeting Link - conditionally shown and auto-generated for Zoho */}
            <Form.Item
                shouldUpdate={(prevValues, currentValues) =>
                    prevValues.location !== currentValues.location ||
                    prevValues.meeting_link !== currentValues.meeting_link
                }
                noStyle
            >
                {({ getFieldValue }) => {
                    const location = getFieldValue("location");
                    const meetingLink = getFieldValue("meeting_link");
                    const showMeetingLinkField = location === "zoho";
                    const isZoho = location === "zoho";
                    const isPhoneOrPhysical = location === "phone" || location === "physical";
                    const needsGeneration = isZoho && !meetingLink && isEditing;

                    if (!showMeetingLinkField) return null;

                    return (
                        <Form.Item
                            name="meeting_link"
                            label={
                                <Space>
                                    Meeting Link
                                    {isZoho && (
                                        <Typography.Text
                                            type="secondary"
                                            style={{ fontSize: "12px" }}
                                        >
                                            (Auto-generated for Zoho)
                                        </Typography.Text>
                                    )}
                                </Space>
                            }
                            rules={[
                                {
                                    type: "url",
                                    message: "Please enter a valid URL",
                                    validator: (_, value) => {
                                        // Don't validate URL format for phone or physical meetings
                                        if (isPhoneOrPhysical) {
                                            return Promise.resolve();
                                        }
                                        if (!value) {
                                            return Promise.resolve();
                                        }
                                        try {
                                            new URL(value);
                                            return Promise.resolve();
                                        } catch {
                                            return Promise.reject(new Error("Please enter a valid URL"));
                                        }
                                    },
                                },
                                {
                                    required: !isZoho && !isPhoneOrPhysical,
                                    message: "Please enter a meeting link",
                                },
                            ]}
                        >
                            <Space.Compact style={{ display: "flex" }}>
                                <Input
                                    placeholder={
                                        isZoho
                                            ? "Meeting link will be auto-generated"
                                            : "Enter meeting link (e.g., https://zoom.us/j/...)"
                                    }
                                    disabled={loading || (isZoho && !isEditing) || isScheduled}
                                    readOnly={isZoho || isScheduled}
                                    style={{ flex: 1 }}
                                />
                                {needsGeneration && (
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

            {/* Remark/Notes */}
            <Form.Item
                label="Meeting Agenda"
                name="remark"
                className="mb-6"
            >
                <HtmlEditor
                    placeholder="Enter meeting agenda, details, or remarks..."
                    disabled={loading || isScheduled}
                    height={250}
                />
            </Form.Item>

            {/* Meeting Reminders - Compact Display */}
            <Card
                title="Meeting Reminders"
                size="small"
                className="mb-4"
                variant="outlined"
            >
                <div className="space-y-4">
                    {/* Default Reminders Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <ClockCircleOutlined className="text-blue-600 mt-0.5" />
                            <div>
                                <Typography.Text
                                    strong
                                    className="text-blue-900"
                                >
                                    Automatic Reminders:
                                </Typography.Text>
                                <Typography.Text className="text-blue-800 ml-2">
                                    {formatDefaultReminders()} before the
                                    meeting
                                </Typography.Text>
                                <div className="mt-1">
                                    <Typography.Text
                                        type="secondary"
                                        className="text-xs"
                                    >
                                        These reminders are automatically
                                        included and cannot be modified.
                                    </Typography.Text>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Custom Reminders */}
                    <div>
                        <Typography.Text strong className="block mb-2">
                            Additional Custom Reminders (Optional):
                        </Typography.Text>

                        <Form.List name="reminders">
                            {(fields, { add, remove }) => (
                                <>
                                    {fields.length > 0 && (
                                        <div className="flex flex-col gap-y-3 mb-3">
                                            {fields.map((field) => (
                                                <div
                                                    key={field.key}
                                                    className="p-3 border border-gray-200 rounded-lg bg-white"
                                                >
                                                    <Space
                                                        className="w-full"
                                                        align="center"
                                                    >
                                                        <Form.Item
                                                            {...field}
                                                            name={[
                                                                field.name,
                                                                "time",
                                                            ]}
                                                            className="mb-0"
                                                            rules={[
                                                                {
                                                                    required:
                                                                        true,
                                                                    message:
                                                                        "Enter time",
                                                                },
                                                                {
                                                                    type: "number",
                                                                    min: 1,
                                                                    max: 1440,
                                                                    message:
                                                                        "Time must be between 1 and 1440",
                                                                },
                                                            ]}
                                                        >
                                                            <InputNumber
                                                                min={1}
                                                                max={1440}
                                                                placeholder="15"
                                                                disabled={
                                                                    loading || isScheduled
                                                                }
                                                                style={{
                                                                    width: 80,
                                                                }}
                                                            />
                                                        </Form.Item>

                                                        <Form.Item
                                                            {...field}
                                                            name={[
                                                                field.name,
                                                                "type",
                                                            ]}
                                                            className="mb-0"
                                                            rules={[
                                                                {
                                                                    required:
                                                                        true,
                                                                    message:
                                                                        "Select unit",
                                                                },
                                                            ]}
                                                        >
                                                            <Select
                                                                placeholder="Unit"
                                                                disabled={
                                                                    loading || isScheduled
                                                                }
                                                                style={{
                                                                    width: 100,
                                                                }}
                                                            >
                                                                {reminderTypes.map(
                                                                    (type) => (
                                                                        <Option
                                                                            key={
                                                                                type.value
                                                                            }
                                                                            value={
                                                                                type.value
                                                                            }
                                                                        >
                                                                            {
                                                                                type.label
                                                                            }
                                                                        </Option>
                                                                    )
                                                                )}
                                                            </Select>
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
                                                                icon={
                                                                    <DeleteOutlined />
                                                                }
                                                                onClick={() =>
                                                                    remove(
                                                                        field.name
                                                                    )
                                                                }
                                                                disabled={
                                                                    loading || isScheduled
                                                                }
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
                                        onClick={() =>
                                            add({ time: 10, type: "minute" })
                                        }
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
            </Card>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-x-3 mt-12 mb-4 pt-4 border-t border-gray-200">
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
        </Form>
    );
}
