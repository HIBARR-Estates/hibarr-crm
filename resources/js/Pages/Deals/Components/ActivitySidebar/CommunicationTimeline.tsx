import { Timeline, Empty, Button, Skeleton, Modal, Drawer } from "antd";
import {
    PhoneOutlined,
    MessageOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    ReloadOutlined,
    ExpandAltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Deal } from "@/Types/api/deals";
import ActivityItem from "./ActivityItem";
import { Activity } from "@/Types/api/activity";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { isLoading as _isLoading } from "@/lib/utils";
import { useState } from "react";

interface Props {
    deal: Deal;
    compact?: boolean;
}

export default function CommunicationTimeline({ deal, compact = true }: Props) {
    const [isExpandedView, setIsExpandedView] = useState(false);
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
        path: route("api.deals.communication-activities.internal", {
            dealId: deal.id,
        }),
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
            width: ${compact ? "32px" : "40px"};
            height: ${compact ? "32px" : "40px"};
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            inset-block-start: calc(40px / 2);
            inset-inline-start: calc(35px / 2);
            z-index: 20;
        }
        .custom-timeline .ant-timeline-item-content {
            margin-left: ${compact ? "12px" : "16px"};
            min-height: auto;
        }
        .expanded-timeline {
            max-height: 80vh;
            overflow-y: auto;
        }
        .compact-timeline {
            max-height: 400px;
            overflow-y: auto;
        }
    `;

    const displayLimit = compact ? 5 : 50;
    const containerHeight = compact ? "max-h-[400px]" : "max-h-[80vh]";

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

    const isLoading = _isLoading({ status });

    const TimelineContent = ({ isModal = false }: { isModal?: boolean }) => (
        <div
            className={`${
                isModal ? "expanded-timeline" : "compact-timeline"
            } ${containerHeight} overflow-y-auto pr-2`}
        >
            <Timeline
                mode="left"
                className="communication-timeline custom-timeline"
                items={activities
                    .slice(0, isModal ? 50 : displayLimit)
                    .map((activity, index) => ({
                        dot: getActivityIcon(
                            activity.type || activity.channel_type || "message"
                        ),
                        children: (
                            <ActivityItem
                                key={index}
                                activity={activity}
                                deal={deal}
                                formatActivityDate={formatActivityDate}
                                handleReplyToMessage={handleReply}
                                compact={compact && !isModal}
                            />
                        ),
                    }))}
            />
            {activities.length > displayLimit && !isModal && compact && (
                <div className="text-center mt-4">
                    <Button
                        type="link"
                        onClick={() => setIsExpandedView(true)}
                        className="text-sm text-blue-600"
                    >
                        View {activities.length - displayLimit} more
                        communications
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <>
            {/* Expanded Timeline Modal */}
            <Drawer
                title={
                    <div className="flex items-center gap-2">
                        <MessageOutlined className="text-blue-600" />
                        <span>
                            Communication Timeline - {deal.name || "Deal"}
                        </span>
                    </div>
                }
                open={isExpandedView}
                onClose={() => setIsExpandedView(false)}
                footer={null}
                size="large"
                className="communication-modal"
            >
                <div className="pt-4">
                    <TimelineContent isModal={true} />
                </div>
            </Drawer>

            <style dangerouslySetInnerHTML={{ __html: timelineStyles }} />
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="mb-6 flex items-center justify-between gap-x-4">
                    <div>
                        <h3
                            className={`font-semibold text-gray-900 mb-1 ${
                                compact ? "text-base" : "text-lg"
                            }`}
                        >
                            Communication Timeline
                        </h3>
                        <p className="text-sm text-gray-600">
                            Recent conversations and interactions
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            icon={<ReloadOutlined />}
                            loading={isRefetching}
                            onClick={() => refetch()}
                            disabled={isLoading || isRefetching}
                            size={compact ? "small" : "middle"}
                        />
                        {compact && activities.length > 0 && (
                            <Button
                                icon={<ExpandAltOutlined />}
                                onClick={() => setIsExpandedView(true)}
                                disabled={isLoading}
                                size="small"
                                title="Expand timeline view"
                                type="text"
                            />
                        )}
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col gap-y-4">
                        {Array(compact ? 3 : 5)
                            .fill(0)
                            .map((_, i) => (
                                <Skeleton
                                    key={i}
                                    paragraph={{ rows: compact ? 3 : 5 }}
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
                    <TimelineContent />
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
