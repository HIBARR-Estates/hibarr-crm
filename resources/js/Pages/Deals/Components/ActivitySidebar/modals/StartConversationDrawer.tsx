import { Deal } from "@/Types/api/deals";
import { Drawer, Form, Select, Button, App, Divider, Input } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import HtmlEditor from "@/Components/HtmlEditor";
import { router, usePage } from "@inertiajs/react";
import { isLoading as _isLoading } from "@/lib/utils";

const { Option } = Select;

interface Props {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    channelType?: string;
    activityIdBeingRepliedTo?: number;
    title?: string;
}

interface ConversationFormData {
    channel_type: string;
    message_content: string;
    subject?: string;
}

interface ConversationResponse {
    message: string;
    data?: any;
}

export default function StartConversationDrawer({
    open,
    onClose,
    deal,
    channelType: _channelType,
    activityIdBeingRepliedTo,
    title = "Start New Conversation",
}: Props) {
    const { message: messageApi } = App.useApp();
    const {
        props: { auth },
    } = usePage();
    const [form] = Form.useForm();

    const conversationMutation = useApiMutate<
        ConversationFormData,
        ConversationResponse,
        ApiResponse<ConversationResponse>
    >(
        route("api.communication-activities.store.internal"),
        "POST",
        (response) => {
            if (response?.status === "success") {
                messageApi.success("Conversation started successfully!");
                form.resetFields();
                onClose();
                router.reload();
            }
        }
    );

    const handleSubmit = (values: ConversationFormData) => {
        // Validate HTML content
        const textContent = (values.message_content || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            messageApi.error("Message is required");
            return;
        }

        const requestData = {
            deal_id: deal.id,
            parent_activity_id: activityIdBeingRepliedTo,
            channel_type: values.channel_type,
            message_content: values.message_content,
            direction: "outbound",
            timestamp: new Date().toISOString(),
            sender_info: {
                name: auth?.user.name || "",
                contact: auth?.user.email || "",
            },
            subject: values.subject || "",
            // Add contact info based on channel
            ...(values.channel_type === "email" && {
                email: deal.contact?.client_email || "",
            }),
            ...(values.channel_type === "whatsapp" && {
                phone_number: deal.contact?.mobile || "",
            }),
            ...(values.channel_type === "instagram" && {
                instagram_username: deal.contact?.client_instagram || "",
            }),
            ...(values.channel_type === "telegram" && {
                telegram_username: deal.contact?.client_telegram || "",
            }),
        };

        conversationMutation.mutate(requestData);
    };

    // Custom validator for HTML content
    const validateHtmlContent = (_: any, value: string) => {
        const textContent = (value || "")
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        if (!textContent || textContent === "") {
            return Promise.reject(new Error("Please enter your message"));
        }
        return Promise.resolve();
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

    const isLoading = _isLoading({ status: conversationMutation.status });

    // watch the channel type to conditionally show subject field and editor type
    const channelType = Form.useWatch("channel_type", form);

    return (
        <Drawer
            title={title}
            open={open}
            onClose={onClose}
            // width={600}
            placement="right"
            className="start-conversation-drawer"
            size="large"
            destroyOnHidden
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                    channel_type: _channelType,
                }}
                className="h-full flex flex-col"
            >
                <Form.Item
                    name="channel_type"
                    label="Select Channel"
                    rules={[
                        { required: true, message: "Please select a channel" },
                    ]}
                >
                    <Select placeholder="Choose communication channel">
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
                {/* subject just for email */}
                <Form.Item
                    name="subject"
                    label="Subject"
                    rules={[
                        { required: true, message: "Please enter a subject" },
                    ]}
                    hidden={channelType !== "email"}
                >
                    <Input
                        placeholder="Enter subject"
                        disabled={isLoading || channelType !== "email"}
                    />
                </Form.Item>

                <Form.Item
                    name="message_content"
                    label="Message"
                    rules={[
                        {
                            required: true,
                            validator: validateHtmlContent,
                        },
                    ]}
                >
                    {/* HTML Editor just for email, use TextArea for all others */}
                    {channelType === "email" ? (
                        <HtmlEditor
                            placeholder="Type your message here..."
                            disabled={isLoading}
                            height={300}
                        />
                    ) : (
                        <Input.TextArea
                            placeholder="Type your message here..."
                            disabled={isLoading}
                            rows={10}
                        />
                    )}
                </Form.Item>

                <Divider />
                <div className="flex justify-end gap-x-2">
                    <Button onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        loading={isLoading}
                        onClick={() => form.submit()}
                    >
                        Send Message
                    </Button>
                </div>
            </Form>
        </Drawer>
    );
}
