import { Timeline, Empty, Button, Skeleton } from "antd";
import {
    PhoneOutlined,
    MessageOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Deal } from "@/Types/api/deals";
import ActivityItem from "./ActivityItem";
import { Activity } from "@/Types/api/activity";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import ViewActivity from "./modals/ViewActivity";
import { isLoading as _isLoading } from "@/lib/utils";

interface Props {
    deal: Deal;
}

export default function CommunicationTimeline({ deal }: Props) {
    const {
        action,
        handleAction,
        handleClose,
        selected: activity,
    } = useGenericEntityAction<Activity>();

    // Fetch communication activities using useApiQuery
    const {
        data: activitiesResponse,
        status,
        isRefetching,
        error,
        refetch,
    } = useApiQuery<{
        data: {
            data: Activity[];
            current_page: number;
            total: number;
        };
    }>({
        path: route("api.deals.communication-activities", { dealId: deal.id }),
    });

    const activities = activitiesResponse?.data?.data || [];

    // Custom CSS for timeline styling
    const timelineStyles = `
        .custom-timeline .ant-timeline-item-tail {
            border-left: 2px solid #e5e7eb;
        }
        .custom-timeline .ant-timeline-item-head {
            background: white;
            border: 2px solid #e5e7eb;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .custom-timeline .ant-timeline-item-content {
            margin-left: 16px;
            min-height: auto;
        }
    `;

    const getActivityIcon = (type: string) => {
        const iconProps = { className: "text-sm" };

        switch (type.toLowerCase()) {
            case "email":
                return (
                    <MailOutlined {...iconProps} className="text-blue-600" />
                );
            case "call":
            case "phone":
                return (
                    <PhoneOutlined {...iconProps} className="text-green-600" />
                );
            case "whatsapp":
                return (
                    <WhatsAppOutlined
                        {...iconProps}
                        className="text-green-500"
                    />
                );
            case "message":
            case "sms":
                return (
                    <MessageOutlined
                        {...iconProps}
                        className="text-purple-600"
                    />
                );
            case "instagram":
                return (
                    <InstagramOutlined
                        {...iconProps}
                        className="text-pink-500"
                    />
                );
            default:
                return (
                    <MessageOutlined {...iconProps} className="text-gray-600" />
                );
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

    const handleReply = (activity: Activity) => {
        handleAction("reply", activity);
    };

    const handleShowFullMessage = (activity: Activity) => {
        handleAction("view", activity);
    };
    const isLoading = _isLoading({ status });

    return (
        <>
            <ViewActivity
                open={action === "view"}
                onClose={handleClose}
                activity={activity}
            />
            <style dangerouslySetInnerHTML={{ __html: timelineStyles }} />
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between gap-x-4">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            Communication Timeline
                        </h3>
                        <p className="text-sm text-gray-600">
                            Recent conversations and interactions
                        </p>
                    </div>
                    <Button
                        icon={<ReloadOutlined />}
                        loading={isRefetching}
                        onClick={() => refetch()}
                        disabled={isLoading || isRefetching}
                    />
                </div>

                {isLoading ? (
                    <div className="flex flex-col gap-y-4">
                        {Array(5)
                            .fill(0)
                            .map((_, i) => (
                                <Skeleton
                                    key={i}
                                    paragraph={{ rows: 5 }}
                                    active
                                />
                            ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <Empty
                            description={
                                <div className="text-gray-500">
                                    <div className="text-base font-medium mb-1">
                                        Failed to load communications
                                    </div>
                                    <div className="text-sm">
                                        There was an error loading the
                                        communication history
                                    </div>
                                </div>
                            }
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            className="text-gray-400"
                        />
                    </div>
                ) : activities.length > 0 ? (
                    // <div className="max-h-[600px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pt-4">
                    <Timeline
                        mode="left"
                        className="communication-timeline custom-timeline"
                        items={activities
                            .slice(0, 50) // Increased from 10 to 50 since we have scrolling
                            .map((activity, index) => ({
                                dot: getActivityIcon(
                                    activity.type ||
                                        activity.channel_type ||
                                        "message"
                                ),
                                children: (
                                    <ActivityItem
                                        key={index}
                                        activity={activity}
                                        formatActivityDate={formatActivityDate}
                                        handleShowFullMessage={
                                            handleShowFullMessage
                                        }
                                        handleReplyToMessage={handleReply}
                                    />
                                ),
                            }))}
                    />
                ) : (
                    <div className="text-center py-12">
                        <Empty
                            description={
                                <div className="text-gray-500">
                                    <div className="text-base font-medium mb-1">
                                        No communications yet
                                    </div>
                                    <div className="text-sm">
                                        Start a conversation to see your
                                        communication history here
                                    </div>
                                </div>
                            }
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            className="text-gray-400"
                        />
                    </div>
                )}
            </div>
        </>
    );
}
