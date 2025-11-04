import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import {
    Modal,
    message,
    Form,
    Input,
    DatePicker,
    TimePicker,
    Select,
    Switch,
    InputNumber,
    Space,
    Button,
} from "antd";
import { CalendarOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import dayjs from "dayjs";

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

interface Props extends IModalProps {
    deal: Deal | null | undefined;
}

const AddDealFollowup: React.FC<Props> = ({ deal, onClose, open }) => {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [showMeetingLink, setShowMeetingLink] = useState(false);
    const [showReminder, setShowReminder] = useState(false);
    const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);

    // Load meeting types when component mounts
    useEffect(() => {
        if (open && deal) {
            // Use default meeting types - can be enhanced later to fetch from API
            setMeetingTypes([
                { id: 1, name: "General Meeting", color: "#1890ff" },
                { id: 2, name: "Client Presentation", color: "#52c41a" },
                { id: 3, name: "Project Review", color: "#faad14" },
                { id: 4, name: "Follow-up Call", color: "#722ed1" },
                { id: 5, name: "Sales Meeting", color: "#f5222d" },
                { id: 6, name: "Support Call", color: "#13c2c2" },
            ]);
        }
    }, [open, deal]);

    const handleSubmit = async (values: any) => {
        if (!deal) {
            message.error("No deal selected");
            return;
        }

        setSaving(true);
        try {
            // Format the date and time
            const next_follow_up_date =
                values.next_follow_up_date.format("DD-MM-YYYY");
            const start_time = values.start_time.format("HH:mm");

            const formData = {
                next_follow_up_date,
                start_time,
                meeting_type_id: values.meeting_type_id,
                location: values.location,
                meeting_link: values.meeting_link || "",
                send_reminder: values.send_reminder || false,
                remind_time: values.remind_time || 15,
                remind_type: values.remind_type || "minute",
                remark: values.remark || "",
                deal_id: deal.id,
            };

            router.post(route("deals.follow_up_store"), formData, {
                onSuccess: () => {
                    message.success("Follow-up created successfully");
                    form.resetFields();
                    setSaving(false);
                    onClose();
                    // Refresh the page to show the new follow-up
                    router.reload();
                },
                onError: (errors: any) => {
                    setSaving(false);
                    const errorMessages = Object.values(errors)
                        .flat()
                        .map(String);
                    message.error(
                        errorMessages.join(", ") ||
                            "Please check the form for errors"
                    );
                },
            });
        } catch (error) {
            setSaving(false);
            message.error("An error occurred while creating the follow-up");
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setShowMeetingLink(false);
        setShowReminder(false);
        onClose();
    };

    const handleLocationChange = (value: string) => {
        setShowMeetingLink(value !== "office");
        if (value === "office") {
            form.setFieldsValue({ meeting_link: "" });
        }
    };

    const handleReminderChange = (checked: boolean) => {
        setShowReminder(checked);
        if (!checked) {
            form.setFieldsValue({
                remind_time: 15,
                remind_type: "minute",
            });
        }
    };

    return (
        <Modal
            title={`Add Follow-up for ${deal?.name || "Deal"}`}
            open={open && !!deal}
            onCancel={handleCancel}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={saving}
                    onClick={() => form.submit()}
                >
                    Save Follow-up
                </Button>,
            ]}
            width={700}
            destroyOnClose
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    next_follow_up_date: dayjs().add(1, "day"),
                    start_time: dayjs().add(30, "minute"),
                    location: "office",
                    send_reminder: false,
                    remind_time: 15,
                    remind_type: "minute",
                }}
            >
                <div className="space-y-4">
                    {/* Deal Information */}
                    {deal && (
                        <div className="p-3 bg-gray-50 rounded">
                            <div className="text-sm text-gray-600">
                                <strong>Client:</strong>{" "}
                                {deal.contact?.client_name || "N/A"}
                            </div>
                            <div className="text-sm text-gray-600">
                                <strong>Deal:</strong> {deal.name}
                            </div>
                        </div>
                    )}

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-4">
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
                                format="DD-MM-YYYY"
                                disabledDate={(current) =>
                                    current && current < dayjs().startOf("day")
                                }
                                prefix={<CalendarOutlined />}
                            />
                        </Form.Item>

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
                            />
                        </Form.Item>
                    </div>

                    {/* Meeting Type and Location */}
                    <div className="grid grid-cols-2 gap-4">
                        <Form.Item name="meeting_type_id" label="Meeting Type">
                            <Select placeholder="Select meeting type">
                                {meetingTypes.map((type) => (
                                    <Option key={type.id} value={type.id}>
                                        {type.name}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item
                            name="location"
                            label="Meeting Location"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a location",
                                },
                            ]}
                        >
                            <Select onChange={handleLocationChange}>
                                <Option value="office">Office</Option>
                                <Option value="zoom">Zoom</Option>
                                <Option value="zoho_meet">Zoho Meet</Option>
                                <Option value="google_meet">Google Meet</Option>
                            </Select>
                        </Form.Item>
                    </div>

                    {/* Meeting Link - Show only if not office */}
                    {showMeetingLink && (
                        <Form.Item
                            name="meeting_link"
                            label="Meeting Link"
                            rules={[
                                {
                                    required: true,
                                    message: "Please provide a meeting link",
                                },
                                {
                                    type: "url",
                                    message: "Please enter a valid URL",
                                },
                            ]}
                        >
                            <Input placeholder="https://..." />
                        </Form.Item>
                    )}

                    {/* Remark */}
                    <Form.Item name="remark" label="Remark">
                        <TextArea
                            rows={3}
                            placeholder="Add any additional notes or remarks"
                        />
                    </Form.Item>

                    {/* Reminder Settings */}
                    <Form.Item
                        name="send_reminder"
                        valuePropName="checked"
                        label="Reminder Settings"
                    >
                        <Switch
                            onChange={handleReminderChange}
                            checkedChildren="Reminder On"
                            unCheckedChildren="Reminder Off"
                        />
                        <span className="ml-2">
                            Send reminder before meeting
                        </span>
                    </Form.Item>

                    {showReminder && (
                        <div className="grid grid-cols-2 gap-4">
                            <Form.Item
                                name="remind_time"
                                label="Remind Before"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please specify reminder time",
                                    },
                                ]}
                            >
                                <InputNumber
                                    min={1}
                                    max={1440}
                                    className="w-full"
                                />
                            </Form.Item>

                            <Form.Item
                                name="remind_type"
                                label="Time Unit"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select time unit",
                                    },
                                ]}
                            >
                                <Select>
                                    <Option value="minute">Minute(s)</Option>
                                    <Option value="hour">Hour(s)</Option>
                                    <Option value="day">Day(s)</Option>
                                </Select>
                            </Form.Item>
                        </div>
                    )}
                </div>
            </Form>
        </Modal>
    );
};

export default AddDealFollowup;
