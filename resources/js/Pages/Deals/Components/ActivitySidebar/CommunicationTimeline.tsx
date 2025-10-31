import { Card, Timeline, Typography, Empty, Button, Space } from "antd";
import {
    PhoneOutlined,
    MessageOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    ClockCircleOutlined,
    MoreOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";
import { Deal } from "@/Types/api/deals";
import ActivityActionsModal from "./modals/ActivityActionsModal";

const { Paragraph } = Typography;

interface Activity {
    id?: number;
    type?: string;
    timestamp: string;
    subject?: string;
    message?: string;
    message_content?: string;
    duration?: string;
    sender_name?: string;
    channel_type?: string;
}

interface Props {
    activities: Activity[];
    deal: Deal;
}

export default function CommunicationTimeline({ activities, deal }: Props) {
    const [activityActionsModal, setActivityActionsModal] = useState<{
        open: boolean;
        activityId?: number;
        channelType?: string;
        activityData?: Activity;
    }>({ open: false });
    const getActivityIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case "email":
                return <MailOutlined className="text-blue-500" />;
            case "call":
            case "phone":
                return <PhoneOutlined className="text-green-500" />;
            case "whatsapp":
                return <WhatsAppOutlined className="text-green-500" />;
            case "message":
            case "sms":
                return <MessageOutlined className="text-purple-500" />;
            case "instagram":
                return <InstagramOutlined className="text-pink-500" />;
            default:
                return <MessageOutlined className="text-gray-500" />;
        }
    };

    const formatActivityDate = (timestamp: string) => {
        const date = dayjs(timestamp);
        const now = dayjs();

        if (date.isSame(now, "day")) {
            return `Today, ${date.format("h:mm A")}`;
        } else if (date.isSame(now.subtract(1, "day"), "day")) {
            return `Yesterday, ${date.format("h:mm A")}`;
        } else {
            return date.format("MMM DD, h:mm A");
        }
    };

    const handleActivityActions = (activity: Activity) => {
        setActivityActionsModal({
            open: true,
            activityId: activity.id,
            channelType: activity.channel_type || activity.type || "message",
            activityData: activity,
        });
    };

    const handleShowFullMessage = (activity: Activity) => {
        const message = activity.message_content || activity.message || "";
        // You could implement a dedicated modal for full message display
        // For now, using the activity actions modal
        handleActivityActions(activity);
    };

    return (
        <>
            <Card
                title="Recent Communications"
                className="shadow-sm border-0 rounded-lg overflow-hidden"
                size="small"
            >
                {activities.length > 0 ? (
                    <Timeline
                        mode="left"
                        className="communication-timeline"
                        items={activities
                            .slice(0, 10)
                            .map((activity, index) => ({
                                dot: getActivityIcon(
                                    activity.type ||
                                        activity.channel_type ||
                                        "message"
                                ),
                                children: (
                                    <div key={index} className="pb-3 group">
                                        <div className="flex items-start justify-between mb-1">
                                            <span className="font-medium text-sm text-gray-900 capitalize">
                                                {activity.type ||
                                                    activity.channel_type ||
                                                    "Communication"}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs text-gray-500">
                                                    {formatActivityDate(
                                                        activity.timestamp
                                                    )}
                                                </span>
                                                {activity.id && (
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<MoreOutlined />}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                        onClick={() =>
                                                            handleActivityActions(
                                                                activity
                                                            )
                                                        }
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        {activity.subject && (
                                            <div className="text-sm font-medium text-gray-700 mb-1">
                                                {activity.subject}
                                            </div>
                                        )}
                                        {(activity.message ||
                                            activity.message_content) && (
                                            <div className="relative">
                                                <Paragraph
                                                    ellipsis={{
                                                        rows: 2,
                                                        expandable: false,
                                                    }}
                                                    className="text-sm text-gray-600 mb-0 cursor-pointer hover:text-gray-800"
                                                    onClick={() =>
                                                        handleShowFullMessage(
                                                            activity
                                                        )
                                                    }
                                                >
                                                    {activity.message_content ||
                                                        activity.message}
                                                </Paragraph>
                                                {(
                                                    activity.message_content ||
                                                    activity.message ||
                                                    ""
                                                ).length > 80 && (
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        className="p-0 h-auto text-xs"
                                                        onClick={() =>
                                                            handleShowFullMessage(
                                                                activity
                                                            )
                                                        }
                                                    >
                                                        Read more
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        {activity.duration && (
                                            <div className="flex items-center space-x-1 mt-1">
                                                <ClockCircleOutlined className="text-xs text-gray-400" />
                                                <span className="text-xs text-gray-500">
                                                    Duration:{" "}
                                                    {activity.duration}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ),
                            }))}
                    />
                ) : (
                    <Empty
                        description="No communications found"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </Card>

            {/* Activity Actions Modal */}
            <ActivityActionsModal
                open={activityActionsModal.open}
                onClose={() => setActivityActionsModal({ open: false })}
                deal={deal}
                activityId={activityActionsModal.activityId || 0}
                channelType={activityActionsModal.channelType || "message"}
                activityData={activityActionsModal.activityData}
            />
        </>
    );
}
