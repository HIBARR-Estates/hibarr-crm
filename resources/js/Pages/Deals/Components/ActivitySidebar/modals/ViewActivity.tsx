import { Modal, Descriptions, Typography, Tag, Button, Divider } from "antd";
import {
    CalendarOutlined,
    UserOutlined,
    MessageOutlined,
    PhoneOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import { Activity } from "@/Types/api/activity";
import { formatCompanyDateTime } from "@/lib/companyDateTime";

const { Text, Paragraph } = Typography;

interface Props {
    open: boolean;
    onClose: () => void;
    activity?: Activity;
}

export default function ViewActivity({ open, onClose, activity }: Props) {
    if (!activity) return null;

    const formatDate = (timestamp: string) =>
        formatCompanyDateTime(timestamp, { separator: " at " });

    const getChannelIcon = (channelType?: string) => {
        const iconProps = { className: "text-base mr-2" };

        switch (channelType?.toLowerCase()) {
            case "email":
                return (
                    <MailOutlined
                        {...iconProps}
                        className="text-blue-600 mr-2"
                    />
                );
            case "call":
            case "phone":
                return (
                    <PhoneOutlined
                        {...iconProps}
                        className="text-green-600 mr-2"
                    />
                );
            case "whatsapp":
                return (
                    <WhatsAppOutlined
                        {...iconProps}
                        className="text-green-500 mr-2"
                    />
                );
            case "message":
            case "sms":
                return (
                    <MessageOutlined
                        {...iconProps}
                        className="text-purple-600 mr-2"
                    />
                );
            case "instagram":
                return (
                    <InstagramOutlined
                        {...iconProps}
                        className="text-pink-500 mr-2"
                    />
                );
            default:
                return (
                    <MessageOutlined
                        {...iconProps}
                        className="text-gray-600 mr-2"
                    />
                );
        }
    };

    const getChannelColor = (channelType?: string) => {
        switch (channelType?.toLowerCase()) {
            case "email":
                return "blue";
            case "call":
            case "phone":
                return "green";
            case "whatsapp":
                return "lime";
            case "message":
            case "sms":
                return "purple";
            case "instagram":
                return "magenta";
            default:
                return "default";
        }
    };

    return (
        <Modal
            title={
                <div className="flex items-center">
                    {getChannelIcon(activity.channel_type)}
                    <span>Activity Details</span>
                </div>
            }
            open={open}
            onCancel={onClose}
            width={700}
            footer={[
                <Button key="close" type="primary" onClick={onClose}>
                    Close
                </Button>,
            ]}
            className="view-activity-modal"
        >
            <div className="space-y-6">
                {/* Header Information */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                            <Tag
                                color={getChannelColor(activity.channel_type)}
                                className="px-3 py-1 text-sm font-medium"
                            >
                                {activity.channel_type?.toUpperCase() ||
                                    activity.type?.toUpperCase() ||
                                    "COMMUNICATION"}
                            </Tag>
                            {activity.duration && (
                                <div className="flex items-center gap-1 text-gray-600">
                                    <ClockCircleOutlined className="text-sm" />
                                    <Text className="text-sm">
                                        {activity.duration}
                                    </Text>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                            <CalendarOutlined className="text-sm" />
                            <Text className="text-sm">
                                {formatDate(activity.timestamp)}
                            </Text>
                        </div>
                    </div>

                    {activity.sender_name && (
                        <div className="flex items-center gap-2">
                            <UserOutlined className="text-gray-500" />
                            <Text strong>{activity.sender_name}</Text>
                        </div>
                    )}
                </div>

                {/* Activity Details */}
                <Descriptions column={1} bordered size="small">
                    <Descriptions.Item
                        label={
                            <span className="font-medium text-gray-700">
                                Activity ID
                            </span>
                        }
                    >
                        <Text code>#{activity.id}</Text>
                    </Descriptions.Item>

                    {activity.subject && (
                        <Descriptions.Item
                            label={
                                <span className="font-medium text-gray-700">
                                    Subject
                                </span>
                            }
                        >
                            <Text strong className="text-gray-900">
                                {activity.subject}
                            </Text>
                        </Descriptions.Item>
                    )}

                    <Descriptions.Item
                        label={
                            <span className="font-medium text-gray-700">
                                Channel Type
                            </span>
                        }
                    >
                        <div className="flex items-center">
                            {getChannelIcon(activity.channel_type)}
                            <span className="capitalize">
                                {activity.channel_type ||
                                    activity.type ||
                                    "General Communication"}
                            </span>
                        </div>
                    </Descriptions.Item>

                    <Descriptions.Item
                        label={
                            <span className="font-medium text-gray-700">
                                Timestamp
                            </span>
                        }
                    >
                        {formatDate(activity.timestamp)}
                    </Descriptions.Item>

                    {activity.sender_name && (
                        <Descriptions.Item
                            label={
                                <span className="font-medium text-gray-700">
                                    Sender
                                </span>
                            }
                        >
                            {activity.sender_name}
                        </Descriptions.Item>
                    )}

                    {activity.duration && (
                        <Descriptions.Item
                            label={
                                <span className="font-medium text-gray-700">
                                    Duration
                                </span>
                            }
                        >
                            {activity.duration}
                        </Descriptions.Item>
                    )}
                </Descriptions>

                {/* Message Content */}
                {(activity.message_content || activity.message) && (
                    <>
                        <Divider
                            orientation="left"
                            className="font-medium text-gray-700"
                        >
                            Message Content
                        </Divider>
                        <div className="bg-white border border-gray-200 rounded-lg p-4">
                            <Paragraph className="text-gray-800 leading-relaxed mb-0">
                                {activity.message_content || activity.message}
                            </Paragraph>
                        </div>
                    </>
                )}

                {/* Activity Type Information */}
                {activity.type && activity.type !== activity.channel_type && (
                    <>
                        <Divider
                            orientation="left"
                            className="font-medium text-gray-700"
                        >
                            Additional Information
                        </Divider>
                        <div className="bg-blue-50 p-3 rounded-lg">
                            <Text className="text-sm text-blue-800">
                                <strong>Activity Type:</strong> {activity.type}
                            </Text>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}
