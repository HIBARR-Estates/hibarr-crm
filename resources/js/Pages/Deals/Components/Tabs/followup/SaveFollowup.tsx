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
    Space,
    Card,
} from "antd";
import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect } from "react";

const { TextArea } = Input;
const { Option } = Select;

interface MeetingType {
    id: number;
    name: string;
    color?: string;
}

interface SaveFollowupFormData {
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    send_reminder?: boolean;
    remind_time?: number;
    remind_type?: string;
    remark?: string;
    deal_id: number;
}

interface Props {
    deal: Deal;
    followup?: DealFollowup;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onSubmit: (data: SaveFollowupFormData) => void;
    onCancel: () => void;
    loading?: boolean;
    errors?: string[];
}

const SaveFollowup: React.FC<Props> = ({
    deal,
    followup,
    meetingTypes,
    onSubmit,
    onCancel,
    loading = false,
    errors = [],
}) => {
    const [form] = Form.useForm();
    const [showMeetingLink, setShowMeetingLink] = useState(false);
    const [showReminder, setShowReminder] = useState(false);

    const locationOptions = [
        { value: "office", label: "Office" },
        { value: "zoom", label: "Zoom" },
        { value: "google-meet", label: "Google Meet" },
        { value: "skype", label: "Skype" },
        { value: "other", label: "Other" },
    ];

    const reminderTypes = [
        { value: "minute", label: "Minutes" },
        { value: "hour", label: "Hours" },
        { value: "day", label: "Days" },
    ];

    // Initialize form with existing data
    useEffect(() => {
        if (followup) {
            const followupDate = dayjs(followup.next_follow_up_date);

            form.setFieldsValue({
                next_follow_up_date: followupDate,
                start_time: followupDate,
                meeting_type_id: followup.meetingType?.id,
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
                values.next_follow_up_date.format("YYYY-MM-DD"),
            start_time: values.start_time.format("HH:mm:ss"),
            meeting_type_id: values.meeting_type_id,
            location: values.location,
            meeting_link: values.meeting_link || "",
            send_reminder: values.send_reminder || false,
            remind_time: values.remind_time,
            remind_type: values.remind_type,
            remark: values.remark || "",
            deal_id: deal.id,
        };

        onSubmit(formData);
    };

    return (
        <div className="p-6">
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                className="space-y-4"
            >
                {/* Display errors */}
                {errors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                        <ul className="list-disc list-inside text-red-600 text-sm">
                            {errors.map((error, index) => (
                                <li key={index}>{error}</li>
                            ))}
                        </ul>
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
                    <Select
                        placeholder="Select meeting type"
                        className="w-full"
                    >
                        {meetingTypes.map((type) => (
                            <Option key={type.id} value={type.id}>
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: type.color }}
                                    />
                                    <span>{type.name}</span>
                                </div>
                            </Option>
                        ))}
                    </Select>
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
                        />
                    </Form.Item>
                )}

                {/* Send Reminder */}
                <Card title="Reminder Settings" size="small" className="mb-4">
                    <Form.Item
                        name="send_reminder"
                        valuePropName="checked"
                        className="mb-4"
                    >
                        <Switch
                            onChange={handleReminderChange}
                            checkedChildren="Yes"
                            unCheckedChildren="No"
                        />
                        <span className="ml-2">
                            Send reminder before meeting
                        </span>
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
                                >
                                    {reminderTypes.map((type) => (
                                        <Option
                                            key={type.value}
                                            value={type.value}
                                        >
                                            {type.label}
                                        </Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </div>
                    )}
                </Card>

                {/* Remark */}
                <Form.Item name="remark" label="Remark/Notes">
                    <TextArea
                        rows={4}
                        placeholder="Enter any additional notes or remarks about this follow-up..."
                        className="w-full"
                    />
                </Form.Item>

                {/* Submit Buttons */}
                <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
                    <Button onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {followup ? "Update Follow-up" : "Create Follow-up"}
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export default SaveFollowup;
