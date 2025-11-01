import { Deal } from "@/Types/api/deals";
import { Modal, Button, message } from "antd";
import { MessageOutlined, EyeOutlined, CloseOutlined } from "@ant-design/icons";
import { useState } from "react";
import StartConversationModal from "./StartConversationModal";

interface Props {
    open: boolean;
    onClose: () => void;
    deal: Deal;
    activityId: number;
    channelType: string;
    activityData?: {
        subject?: string;
        message_content?: string;
        timestamp?: string;
        sender_name?: string;
    };
}

export default function ActivityActionsModal({
    open,
    onClose,
    deal,
    activityId,
    channelType,
    activityData,
}: Props) {
    const [replyModalOpen, setReplyModalOpen] = useState(false);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);

    const handleReplyToActivity = () => {
        setReplyModalOpen(true);
        onClose();
    };

    const handleViewDetails = () => {
        setDetailsModalOpen(true);
    };

    return (
        <>
            <Modal
                title="Activity Actions"
                open={open}
                onCancel={onClose}
                width={400}
                footer={null}
                className="activity-actions-modal"
            >
                <div className="space-y-3">
                    {activityData && (
                        <div className="p-3 bg-gray-50 rounded-lg mb-4">
                            <div className="text-sm text-gray-600 mb-1">
                                {channelType.charAt(0).toUpperCase() +
                                    channelType.slice(1)}{" "}
                                Activity
                            </div>
                            {activityData.subject && (
                                <div className="font-medium text-gray-900 mb-1">
                                    {activityData.subject}
                                </div>
                            )}
                            {activityData.message_content && (
                                <div className="text-sm text-gray-700 line-clamp-2">
                                    {activityData.message_content.length > 100
                                        ? `${activityData.message_content.substring(
                                              0,
                                              100
                                          )}...`
                                        : activityData.message_content}
                                </div>
                            )}
                        </div>
                    )}

                    <Button
                        type="primary"
                        icon={<MessageOutlined />}
                        onClick={handleReplyToActivity}
                        className="w-full justify-start"
                        size="large"
                    >
                        Reply to Activity
                    </Button>

                    <Button
                        type="default"
                        icon={<EyeOutlined />}
                        onClick={handleViewDetails}
                        className="w-full justify-start"
                        size="large"
                    >
                        View Full Details
                    </Button>

                    <Button
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        className="w-full justify-start"
                        size="large"
                    >
                        Cancel
                    </Button>
                </div>
            </Modal>

            {/* Reply Modal */}
            <StartConversationModal
                open={replyModalOpen}
                onClose={() => setReplyModalOpen(false)}
                deal={deal}
                channelType={channelType}
                activityIdBeingRepliedTo={activityId}
                title="Reply to Activity"
            />

            {/* Details Modal */}
            <Modal
                title="Activity Details"
                open={detailsModalOpen}
                onCancel={() => setDetailsModalOpen(false)}
                width={600}
                footer={[
                    <Button
                        key="close"
                        onClick={() => setDetailsModalOpen(false)}
                    >
                        Close
                    </Button>,
                ]}
            >
                {activityData ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Channel Type
                            </label>
                            <div className="text-sm text-gray-900 capitalize">
                                {channelType}
                            </div>
                        </div>

                        {activityData.subject && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Subject
                                </label>
                                <div className="text-sm text-gray-900">
                                    {activityData.subject}
                                </div>
                            </div>
                        )}

                        {activityData.message_content && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Message
                                </label>
                                <div className="text-sm text-gray-900 p-3 bg-gray-50 rounded-lg">
                                    {activityData.message_content}
                                </div>
                            </div>
                        )}

                        {activityData.timestamp && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Timestamp
                                </label>
                                <div className="text-sm text-gray-900">
                                    {new Date(
                                        activityData.timestamp
                                    ).toLocaleString()}
                                </div>
                            </div>
                        )}

                        {activityData.sender_name && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Sender
                                </label>
                                <div className="text-sm text-gray-900">
                                    {activityData.sender_name}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <EyeOutlined className="text-4xl text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                            No Details Available
                        </h3>
                        <p className="text-gray-500">
                            Activity details are not available at the moment.
                        </p>
                    </div>
                )}
            </Modal>
        </>
    );
}
