import { useState } from "react";
import { Button, Input, Form, App } from "antd";
import { SendOutlined, CloseOutlined } from "@ant-design/icons";
import { Activity } from "@/Types/api/activity";
import { Deal } from "@/Types/api/deals";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { usePage, router } from "@inertiajs/react";
import { isLoading as _isLoading } from "@/lib/utils";

interface Props {
    activity: Activity;
    deal: Deal;
    onCancel: () => void;
}

interface ConversationFormData {
    channel_type: string;
    message_content: string;
    subject?: string;
    parent_activity_id: number;
}

interface ConversationResponse {
    message: string;
    data?: any;
}

export default function QuickReply({ activity, deal, onCancel }: Props) {
    const { message: messageApi } = App.useApp();
    const [form] = Form.useForm();
    const {
        props: { auth },
    } = usePage();

    // Early return if channel type is not available
    if (!activity.channel_type) {
        return null;
    }

    const conversationMutation = useApiMutate<
        ConversationFormData,
        ConversationResponse,
        ApiResponse<ConversationResponse>
    >(
        route("api.communication-activities.store.internal"),
        "POST",
        (response) => {
            if (response?.status === "success") {
                messageApi.success("Reply sent successfully!");
                form.resetFields();
                onCancel();
                router.reload();
            }
        }
    );

    const isLoading = _isLoading({ status: conversationMutation.status });

    const handleSubmit = (values: ConversationFormData) => {
        const textContent = values.message_content?.trim();

        if (!textContent || textContent === "") {
            messageApi.error("Message is required");
            return;
        }

        // Prepare subject for email replies
        let subject = "";
        if (activity.channel_type === "email") {
            const originalSubject = activity.subject || "";
            if (originalSubject && !originalSubject.startsWith("Re: ")) {
                subject = `Re: ${originalSubject}`;
            } else if (originalSubject) {
                subject = originalSubject;
            }
        }

        const requestData = {
            deal_id: deal.id,
            parent_activity_id: activity.id,
            channel_type: activity.channel_type!,
            message_content: values.message_content,
            direction: "outbound",
            timestamp: new Date().toISOString(),
            sender_info: {
                name: auth?.user.name || "",
                contact: auth?.user.email || "",
            },
            subject,
            // Add contact info based on channel
            ...(activity.channel_type === "email" && {
                email: deal.contact?.client_email || "",
            }),
            ...(activity.channel_type === "whatsapp" && {
                phone_number: deal.contact?.mobile || "",
                whatsapp_username: deal.contact?.mobile || "",
            }),
            ...(activity.channel_type === "instagram" && {
                instagram_username: deal.contact?.client_instagram || "",
            }),
            ...(activity.channel_type === "telegram" && {
                telegram_username: deal.contact?.client_telegram || "",
                chat_id: activity.chat_id || "",
            }),
        } as any;

        conversationMutation.mutate(requestData);
    };

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3 mx-3">
            <Form
                form={form}
                onFinish={handleSubmit}
                layout="vertical"
                className="quick-reply-form"
            >
                {/* Show subject preview for email replies */}
                {activity.channel_type === "email" && activity.subject && (
                    <div className="mb-3 p-2 bg-gray-100 rounded text-sm text-gray-600">
                        <strong>Subject:</strong> Re: {activity.subject}
                    </div>
                )}

                <Form.Item
                    name="message_content"
                    label={`Quick Reply via ${activity.channel_type?.toUpperCase()}`}
                    rules={[
                        {
                            required: true,
                            message: "Please enter your reply message",
                        },
                        {
                            min: 1,
                            message: "Message cannot be empty",
                        },
                    ]}
                    className="mb-4"
                >
                    <Input.TextArea
                        placeholder={`Type your ${activity.channel_type} reply here...`}
                        disabled={isLoading}
                        rows={3}
                        autoFocus
                        className="resize-none"
                    />
                </Form.Item>

                <div className="flex justify-end gap-2">
                    <Button
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={onCancel}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="primary"
                        size="small"
                        icon={<SendOutlined />}
                        loading={isLoading}
                        onClick={() => form.submit()}
                        className="bg-blue-600"
                    >
                        Send Reply
                    </Button>
                </div>
            </Form>
        </div>
    );
}
