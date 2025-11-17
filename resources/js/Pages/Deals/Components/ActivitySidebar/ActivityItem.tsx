import { Typography, Button } from "antd";
import { ClockCircleOutlined, MessageOutlined } from "@ant-design/icons";
import { Activity } from "@/Types/api/activity";
import { Deal } from "@/Types/api/deals";
import { useState } from "react";
import QuickReply from "./QuickReply";

const { Paragraph } = Typography;

interface ActivityItemProps {
    activity?: Activity;
    deal?: Deal;
    formatActivityDate: (timestamp: string) => string;
    handleShowFullMessage?: (activity: Activity) => void;
    handleReplyToMessage?: (activity: Activity) => void;
    compact?: boolean;
}

export default function ActivityItem({
    activity,
    deal,
    formatActivityDate,
    handleShowFullMessage,
    handleReplyToMessage,
    compact = false,
}: ActivityItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [showQuickReply, setShowQuickReply] = useState(false);
    const message = activity?.message_content || activity?.message || "";

    if (!activity) return null;

    const shouldTruncate = message.length > 120;
    const displayMessage =
        isExpanded || !shouldTruncate
            ? message
            : `${message.substring(0, 120)}`;
    const showReadMore = shouldTruncate && !isExpanded;
    const showReadLess = shouldTruncate && isExpanded;

    const handleToggleExpansion = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const handleReply = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (handleReplyToMessage) {
            handleReplyToMessage(activity);
        } else {
            setShowQuickReply(true);
        }
    };

    return (
        <div
            className="pb-4 group cursor-pointer"
            onClick={
                handleShowFullMessage
                    ? () => handleShowFullMessage(activity)
                    : undefined
            }
        >
            <div className="p-3 transition-all duration-200">
                <div
                    className={`bg-gray-50 p-1 rounded-md group-hover:bg-gray-100 ${
                        compact ? "p-2" : ""
                    }`}
                >
                    {/* Message Content */}
                    {message && (
                        <div className="relative mb-3">
                            <div className="p-3">
                                <div className="text-sm text-gray-700 leading-relaxed">
                                    {displayMessage}
                                    {showReadMore && (
                                        <>
                                            <span className="text-gray-500">
                                                ...
                                            </span>
                                            <span
                                                className="ml-1 text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                                                onClick={handleToggleExpansion}
                                            >
                                                Read more
                                            </span>
                                        </>
                                    )}
                                    {showReadLess && (
                                        <span
                                            className="ml-2 text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                                            onClick={handleToggleExpansion}
                                        >
                                            Show less
                                        </span>
                                    )}
                                </div>
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

                    {/* Header */}
                    <div className="flex items-center justify-between mt-1 mb-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                            {(handleReplyToMessage || deal) && (
                                <span
                                    className="cursor-pointer text-xs text-blue-900 mx-1 hover:text-blue-700"
                                    onClick={handleReply}
                                    title="Reply to this message"
                                >
                                    Reply
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                                {formatActivityDate(activity.timestamp)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Inline Quick Reply */}
            {showQuickReply && deal && (
                <QuickReply
                    activity={activity}
                    deal={deal}
                    onCancel={() => setShowQuickReply(false)}
                />
            )}
        </div>
    );
}
