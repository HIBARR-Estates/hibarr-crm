import { Deal } from "@/Types/api/deals";
import {
    Modal,
    Form,
    Input,
    Button,
    message,
    DatePicker,
    TimePicker,
} from "antd";
import {
    CalendarOutlined,
    CloseOutlined,
    MailOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";

const { TextArea } = Input;

interface Props {
    open: boolean;
    onClose: () => void;
    deal: Deal;
}

interface ScheduleMeetingData {
    subject: string;
    body: string;
    email: string;
}

export default function ScheduleMeetingModal({ open, onClose, deal }: Props) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: any) => {
        const contact = deal.contact;

        if (!contact?.client_email) {
            message.error("Contact has no email address");
            return;
        }

        setLoading(true);

        try {
            const meetingDate = values.date
                ? dayjs(values.date).format("MMMM DD, YYYY")
                : "TBD";
            const meetingTime = values.time
                ? dayjs(values.time).format("h:mm A")
                : "TBD";

            const subject = encodeURIComponent(
                values.subject || `Meeting: ${deal.name}`
            );
            const body = encodeURIComponent(
                values.notes
                    ? `Hi ${contact.client_name || "there"},\n\n${
                          values.notes
                      }\n\nMeeting Details:\nDate: ${meetingDate}\nTime: ${meetingTime}\n\nBest regards,\n${
                          values.senderName || "Your Name"
                      }`
                    : `Hi ${
                          contact.client_name || "there"
                      },\n\nI'd like to schedule a meeting to discuss ${
                          deal.name
                      }.\n\nMeeting Details:\nDate: ${meetingDate}\nTime: ${meetingTime}\n\nBest regards,\n${
                          values.senderName || "Your Name"
                      }`
            );

            // Open email client with pre-filled content
            window.open(
                `mailto:${contact.client_email}?subject=${subject}&body=${body}`,
                "_blank"
            );

            message.success("Email client opened with meeting details");
            form.resetFields();
            onClose();
        } catch (error) {
            console.error("Error scheduling meeting:", error);
            message.error("Failed to open email client");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSchedule = () => {
        const contact = deal.contact;

        if (!contact?.client_email) {
            message.error("Contact has no email address");
            return;
        }

        const subject = encodeURIComponent(`Meeting: ${deal.name}`);
        const body = encodeURIComponent(
            `Hi ${
                contact.client_name || "there"
            },\n\nI'd like to schedule a meeting to discuss ${
                deal.name
            }.\n\nBest regards,\nYour Name`
        );

        window.open(
            `mailto:${contact.client_email}?subject=${subject}&body=${body}`,
            "_blank"
        );

        message.success("Email client opened");
        onClose();
    };

    if (!deal.contact?.client_email) {
        return (
            <Modal
                title="Schedule Meeting"
                open={open}
                onCancel={onClose}
                width={500}
                footer={[
                    <Button key="close" onClick={onClose}>
                        Close
                    </Button>,
                ]}
            >
                <div className="text-center py-8">
                    <MailOutlined className="text-4xl text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        No Email Address
                    </h3>
                    <p className="text-gray-500">
                        This contact doesn't have an email address. Please add
                        one to schedule a meeting.
                    </p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title="Schedule Meeting"
            open={open}
            onCancel={onClose}
            width={600}
            footer={null}
            className="schedule-meeting-modal"
        >
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center mb-2">
                    <MailOutlined className="text-blue-600 mr-2" />
                    <span className="font-medium text-blue-900">
                        Meeting with: {deal.contact?.client_name}
                    </span>
                </div>
                <p className="text-blue-700 text-sm">
                    Email: {deal.contact?.client_email}
                </p>
            </div>

            <div className="flex gap-3 mb-6">
                <Button
                    type="primary"
                    icon={<CalendarOutlined />}
                    onClick={handleQuickSchedule}
                    className="flex-1"
                >
                    Quick Schedule (Basic Email)
                </Button>
                <Button
                    type="default"
                    onClick={() => form.submit()}
                    loading={loading}
                    className="flex-1"
                >
                    Custom Schedule
                </Button>
            </div>

            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    subject: `Meeting: ${deal.name}`,
                    senderName: "Your Name", // You might want to get this from props or context
                }}
            >
                <Form.Item
                    name="subject"
                    label="Meeting Subject"
                    rules={[
                        {
                            required: true,
                            message: "Please enter meeting subject",
                        },
                    ]}
                >
                    <Input placeholder="Enter meeting subject" />
                </Form.Item>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="date" label="Preferred Date">
                        <DatePicker
                            className="w-full"
                            placeholder="Select date"
                            disabledDate={(current) =>
                                current && current < dayjs().startOf("day")
                            }
                        />
                    </Form.Item>

                    <Form.Item name="time" label="Preferred Time">
                        <TimePicker
                            className="w-full"
                            placeholder="Select time"
                            format="h:mm A"
                            use12Hours
                        />
                    </Form.Item>
                </div>

                <Form.Item name="senderName" label="Your Name">
                    <Input placeholder="Enter your name" />
                </Form.Item>

                <Form.Item name="notes" label="Additional Notes">
                    <TextArea
                        rows={4}
                        placeholder="Add any additional details about the meeting..."
                        showCount
                        maxLength={500}
                    />
                </Form.Item>

                <div className="flex justify-end gap-2 mt-6">
                    <Button
                        onClick={onClose}
                        icon={<CloseOutlined />}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<CalendarOutlined />}
                        loading={loading}
                    >
                        Open Email Client
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
