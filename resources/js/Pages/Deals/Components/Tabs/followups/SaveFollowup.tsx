import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
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
} from "antd";
import {
    CalendarOutlined,
    ClockCircleOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import HtmlEditor from "@/Components/HtmlEditor";
import MeetingTypeSelector from "./MeetingTypeSelector";

const { TextArea } = Input;
const { Option } = Select;

interface SaveFollowupFormData {
    deal_id: number;
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    send_reminder?: boolean;
    remind_time?: number;
    remind_type?: string;
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
    const [showMeetingLink, setShowMeetingLink] = useState(false);
    const [showReminder, setShowReminder] = useState(false);

    const isEditing = !!followup;

    const locationOptions = [
        { value: "office", label: "Office" },
        { value: "zoom", label: "Zoom" },
        { value: "teams", label: "Microsoft Teams" },
        { value: "meet", label: "Google Meet" },
        { value: "phone", label: "Phone Call" },
        { value: "skype", label: "Skype" },
        { value: "other", label: "Other" },
    ];

    const reminderTypes = [
        { value: "minute", label: "Minutes" },
        { value: "hour", label: "Hours" },
        { value: "day", label: "Days" },
    ];

    // Initialize form with followup data if editing
    useEffect(() => {
        if (followup) {
            const followupDate = dayjs(followup.next_follow_up_date);

            form.setFieldsValue({
                next_follow_up_date: followupDate,
                start_time: followupDate,
                meeting_type_id: followup.meeting_type?.id,
                location: followup.location || "office",
                meeting_link: followup.meeting_link || "",
                send_reminder: false, // This would need to be added to the interface
                remind_time: 15,
                remind_type: "minute",
                remark: followup.remark || "",
            });

            setShowMeetingLink(
                followup.location !== "office" && !!followup.location
            );
            setShowReminder(false); // This would need to be based on actual data
        } else {
            // Set default values for new follow-up
            form.setFieldsValue({
                location: "office",
                send_reminder: false,
                remind_time: 15,
                remind_type: "minute",
            });
        }
    }, [followup, form]);

    const handleLocationChange = (value: string) => {
        setShowMeetingLink(value !== "office");
        if (value === "office") {
            form.setFieldValue("meeting_link", "");
        }
    };

    const handleReminderChange = (checked: boolean) => {
        setShowReminder(checked);
        if (!checked) {
            form.setFieldsValue({
                remind_time: undefined,
                remind_type: undefined,
            });
        }
    };

    const handleSubmit = (values: any) => {
        const formData: SaveFollowupFormData = {
            next_follow_up_date:
                values.next_follow_up_date.format("DD-MM-YYYY"),
            start_time: values.start_time.format("HH:mm:ss"),
            meeting_type_id: values.meeting_type_id,
            location: values.location,
            meeting_link: values.meeting_link || "",
            send_reminder: values.send_reminder || false,
            remind_time: values.remind_time || 0,
            remind_type: values.remind_type,
            remark: values.remark || "",
            deal_id: deal.id,
        };

        onSubmit(formData);
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
            className="space-y-4"
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
                    label="Follow-up Date"
                    rules={[
                        {
                            required: true,
                            message: "Please select a follow-up date",
                        },
                    ]}
                >
                    <DatePicker
                        className="w-full"
                        format="YYYY-MM-DD"
                        disabled={loading}
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
                        disabled={loading}
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
                    disabled={loading}
                    placeholder="Select meeting type"
                />
            </Form.Item>

            {/* Location */}
            <Form.Item
                name="location"
                label="Location"
                rules={[
                    {
                        required: true,
                        message: "Please select a location",
                    },
                ]}
            >
                <Select
                    placeholder="Select location"
                    className="w-full"
                    disabled={loading}
                    onChange={handleLocationChange}
                >
                    {locationOptions.map((option) => (
                        <Option key={option.value} value={option.value}>
                            {option.label}
                        </Option>
                    ))}
                </Select>
            </Form.Item>

            {/* Meeting Link - conditionally shown */}
            {showMeetingLink && (
                <Form.Item
                    name="meeting_link"
                    label="Meeting Link"
                    rules={[
                        {
                            type: "url",
                            message: "Please enter a valid URL",
                        },
                    ]}
                >
                    <Input
                        placeholder="Enter meeting link (e.g., https://zoom.us/j/...)"
                        className="w-full"
                        disabled={loading}
                    />
                </Form.Item>
            )}

            {/* Remark/Notes */}
            <Form.Item
                label="Follow-up Summary/Remarks"
                name="remark"
                className="mb-6"
                rules={[
                    {
                        required: true,
                        validator: validateContent,
                    },
                ]}
            >
                <HtmlEditor
                    placeholder="Enter follow-up details, agenda, or remarks..."
                    disabled={loading}
                    height={250}
                />
            </Form.Item>

            {/* Send Reminder */}
            <Card title="Reminder Settings" size="small" className="mb-4">
                <Form.Item
                    name="send_reminder"
                    valuePropName="checked"
                    className="mb-4"
                >
                    <Switch
                        onChange={handleReminderChange}
                        disabled={loading}
                        checkedChildren="Yes"
                        unCheckedChildren="No"
                    />
                    <span className="ml-2">Send reminder before meeting</span>
                </Form.Item>

                {showReminder && (
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item
                            name="remind_time"
                            label="Remind before"
                            rules={[
                                {
                                    required: showReminder,
                                    message: "Please enter reminder time",
                                },
                            ]}
                        >
                            <InputNumber
                                min={1}
                                max={1440}
                                className="w-full"
                                placeholder="15"
                                disabled={loading}
                            />
                        </Form.Item>

                        <Form.Item
                            name="remind_type"
                            label="Time unit"
                            rules={[
                                {
                                    required: showReminder,
                                    message: "Please select time unit",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select unit"
                                className="w-full"
                                disabled={loading}
                            >
                                {reminderTypes.map((type) => (
                                    <Option key={type.value} value={type.value}>
                                        {type.label}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </div>
                )}
            </Card>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end space-x-3 mt-12 mb-4 pt-4 border-t border-gray-200">
                <Button onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<SaveOutlined />}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    {isEditing ? "Update Follow-up" : "Schedule Follow-up"}
                </Button>
            </div>
        </Form>
    );
}
