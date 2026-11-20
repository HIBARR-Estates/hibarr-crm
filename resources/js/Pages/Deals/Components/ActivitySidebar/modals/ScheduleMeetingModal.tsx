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
import {
    companyDateDayjsFormat,
    formatCompanyDate,
    formatCompanyTime,
    companyTimeDayjsFormat,
} from "@/lib/companyDateTime";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: any) => {
        const contact = deal.contact;

        if (!contact?.client_email) {
            message.error(td("Contact has no email address", { source: "en" }));
            return;
        }

        setLoading(true);

        try {
            const meetingDate = values.date
                ? formatCompanyDate(values.date)
                : "TBD";
            const meetingTime = values.time
                ? formatCompanyTime(values.time)
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

            message.success(td("Email client opened with meeting details", { source: "en" }));
            form.resetFields();
            onClose();
        } catch (error) {
            console.error("Error scheduling meeting:", error);
            message.error(td("Failed to open email client", { source: "en" }));
        } finally {
            setLoading(false);
        }
    };

    const handleQuickSchedule = () => {
        const contact = deal.contact;

        if (!contact?.client_email) {
            message.error(td("Contact has no email address", { source: "en" }));
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

        message.success(td("Email client opened", { source: "en" }));
        onClose();
    };

    if (!deal.contact?.client_email) {
        return (
            <Modal
                title={td("Schedule Meeting", { source: "en" })}
                open={open}
                onCancel={onClose}
                width={500}
                footer={[
                    <Button key="close" onClick={onClose}>
                        {td("Close", { source: "en" })}
                    </Button>,
                ]}
            >
                <div className="text-center py-8">
                    <MailOutlined className="text-4xl text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {td("No Email Address", { source: "en" })}
                    </h3>
                    <p className="text-gray-500">
                        {td("This contact doesn't have an email address. Please add one to schedule a meeting.", { source: "en" })}
                    </p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            title={td("Schedule Meeting", { source: "en" })}
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
                    {td("Quick Schedule (Basic Email)", { source: "en" })}
                </Button>
                <Button
                    type="default"
                    onClick={() => form.submit()}
                    loading={loading}
                    className="flex-1"
                >
                    {td("Custom Schedule", { source: "en" })}
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
                    label={td("Meeting Subject", { source: "en" })}
                    rules={[
                        {
                            required: true,
                            message: "Please enter meeting subject",
                        },
                    ]}
                >
                    <Input placeholder={td("Enter meeting subject", { source: "en" })} />
                </Form.Item>

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="date" label={td("Preferred Date", { source: "en" })}>
                        <DatePicker
                            className="w-full"
                            placeholder={td("Select date", { source: "en" })}
                            format={companyDateDayjsFormat()}
                            disabledDate={(current) =>
                                current && current < dayjs().startOf("day")
                            }
                        />
                    </Form.Item>

                    <Form.Item name="time" label={td("Preferred Time", { source: "en" })}>
                        <TimePicker
                            className="w-full"
                            placeholder={td("Select time", { source: "en" })}
                            format={companyTimeDayjsFormat()}
                        />
                    </Form.Item>
                </div>

                <Form.Item name="senderName" label={td("Your Name", { source: "en" })}>
                    <Input placeholder={td("Enter your name", { source: "en" })} />
                </Form.Item>

                <Form.Item name="notes" label={td("Additional Notes", { source: "en" })}>
                    <TextArea
                        rows={4}
                        placeholder={td("Add any additional details about the meeting...", { source: "en" })}
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
                        {td("Cancel", { source: "en" })}
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<CalendarOutlined />}
                        loading={loading}
                    >
                        {td("Open Email Client", { source: "en" })}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
