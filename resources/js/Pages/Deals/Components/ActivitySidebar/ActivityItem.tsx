import { Typography, Button } from "antd";
import { ClockCircleOutlined, MessageOutlined } from "@ant-design/icons";
import { Activity } from "@/Types/api/activity";

const { Paragraph } = Typography;

interface ActivityItemProps {
    activity?: Activity;
    formatActivityDate: (timestamp: string) => string;
    handleShowFullMessage: (activity: Activity) => void;
    handleReplyToMessage?: (activity: Activity) => void;
}

export default function ActivityItem({
    activity,

    formatActivityDate,
    handleShowFullMessage,
    handleReplyToMessage,
}: ActivityItemProps) {
    if (!activity) return null;
    return (
        <div className="pb-4 group">
            <div className="p-3 transition-all duration-200">
                <div className="bg-gray-50 p-1 rounded-md">
                    {/* body */}

                    <div>
                        {/* Subject */}
                        {activity.subject && (
                            <div className="text-sm font-medium text-gray-800 mb-2 border-l-3 border-blue-400 pl-3">
                                {activity.subject}
                            </div>
                        )}

                        {/* Message Content */}
                        {(activity.message || activity.message_content) && (
                            <div className="relative mb-3">
                                <div className="p-3">
                                    <Paragraph
                                        ellipsis={{
                                            rows: 3,
                                            expandable: false,
                                        }}
                                        className="text-sm text-gray-700 mb-0 leading-relaxed"
                                    >
                                        {activity.message_content ||
                                            activity.message}
                                    </Paragraph>
                                    {(
                                        activity.message_content ||
                                        activity.message ||
                                        ""
                                    ).length > 120 && (
                                        <Button
                                            type="link"
                                            size="small"
                                            className="p-0 h-auto text-xs mt-1 text-blue-600 hover:text-blue-800"
                                            onClick={() =>
                                                handleShowFullMessage(activity)
                                            }
                                        >
                                            Read more →
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Duration */}
                        {activity.duration && (
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100 mb-1">
                                <div className="flex items-center gap-1 text-gray-500">
                                    <ClockCircleOutlined className="text-xs" />
                                    <span className="text-xs">
                                        Duration: {activity.duration}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    {/* Header */}
                    <div className="flex items-center justify-between mt-1 mb-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 capitalize">
                                {activity.type ||
                                    activity.channel_type ||
                                    "Communication"}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                {formatActivityDate(activity.timestamp)}
                            </span>
                            {/* Reply to Message */}

                            {handleReplyToMessage && (
                                <span
                                    className="cursor-pointer text-xs opacity-0 hidden group-hover:block group-hover:opacity-100 transition-opacity  text-blue-900 mx-1"
                                    onClick={() =>
                                        handleReplyToMessage(activity)
                                    }
                                    title="Reply to this message"
                                >
                                    Reply
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
