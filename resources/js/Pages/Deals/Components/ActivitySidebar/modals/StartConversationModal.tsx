import { Deal } from "@/Types/api/deals";
import { Modal, Form, Select, Input, Button, message, App } from "antd";
import { SendOutlined, CloseOutlined } from "@ant-design/icons";
import { useState } from "react";
import { router } from "@inertiajs/react";

const { TextArea } = Input;
const { Option } = Select;

interface Props {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    channelType?: string;
    activityIdBeingRepliedTo?: number;
    title?: string;
}

interface ConversationData {
    channel_type: string;
    message_content: string;
    direction: "outbound";
    timestamp: string;
    deal_id: number;
    activity_id_being_replied_to?: number;
    email?: string;
    phone_number?: string;
    instagram_username?: string;
    telegram_username?: string;
    sender_info: {
        name: string;
        contact: string;
    };
}

export default function StartConversationModal({
    open,
    onClose,
    deal,
    channelType,
    activityIdBeingRepliedTo,
    title = "Start New Conversation",
}: Props) {
    const { message: messageApi } = App.useApp();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: {
        channel_type: string;
        message_content: string;
    }) => {
        if (!values.message_content?.trim()) {
            messageApi.error("Message is required");
            return;
        }

        setLoading(true);

        try {
            const dealData: ConversationData = {
                deal_id: deal.id,
                activity_id_being_replied_to: activityIdBeingRepliedTo,
                channel_type: values.channel_type,
                message_content: values.message_content,
                direction: "outbound",
                timestamp: new Date().toISOString(),
                sender_info: {
                    name: "Current User", // You might want to get this from props or context
                    contact: "user@example.com", // You might want to get this from props or context
                },
            };

            // Add contact info based on channel
            if (values.channel_type === "email") {
                dealData.email = deal.contact?.client_email || "";
            } else if (values.channel_type === "whatsapp") {
                dealData.phone_number = deal.contact?.mobile || "";
            } else if (values.channel_type === "instagram") {
                dealData.instagram_username =
                    deal.contact?.client_instagram || "";
            } else if (values.channel_type === "telegram") {
                dealData.telegram_username =
                    deal.contact?.client_telegram || "";
            }

            const response = await fetch(
                "/api/v1/internal/communication-activities",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-COMPANY-ID": "1", // You might want to get this from props or context
                        "X-CSRF-TOKEN":
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute("content") || "",
                    },
                    body: JSON.stringify(dealData),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to send message");
            }

            message.success("Conversation started successfully!");
            form.resetFields();
            onClose();

            // Refresh the page or update the activities
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (error) {
            console.error("Error starting conversation:", error);
            message.error(
                error instanceof Error
                    ? error.message
                    : "Failed to start conversation"
            );
        } finally {
            setLoading(false);
        }
    };

    const channelOptions = [
        {
            value: "email",
            label: "Email",
            disabled: !deal.contact?.client_email,
        },
        {
            value: "whatsapp",
            label: "WhatsApp",
            disabled: !deal.contact?.mobile,
        },
        {
            value: "instagram",
            label: "Instagram",
            disabled: !deal.contact?.client_instagram,
        },
        {
            value: "telegram",
            label: "Telegram",
            disabled: !deal.contact?.client_telegram,
        },
    ];

    return (
        <Modal
            title={title}
            open={open}
            onCancel={onClose}
            width={600}
            footer={null}
            className="start-conversation-modal"
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    channel_type: channelType || "email",
                }}
            >
                <Form.Item
                    name="channel_type"
                    label="Select Channel"
                    rules={[
                        { required: true, message: "Please select a channel" },
                    ]}
                >
                    <Select
                        disabled={!!channelType}
                        placeholder="Choose communication channel"
                    >
                        {channelOptions.map((option) => (
                            <Option
                                key={option.value}
                                value={option.value}
                                disabled={option.disabled}
                            >
                                {option.label}
                                {option.disabled && " (No contact info)"}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="message_content"
                    label="Message"
                    rules={[
                        {
                            required: true,
                            message: "Please enter your message",
                        },
                    ]}
                >
                    <TextArea
                        rows={4}
                        placeholder="Type your message here..."
                        showCount
                        maxLength={1000}
                    />
                </Form.Item>

                <div className="flex justify-end gap-2 mt-6">
                    <Button onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SendOutlined />}
                        loading={loading}
                    >
                        Send Message
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
