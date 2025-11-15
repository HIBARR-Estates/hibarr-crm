import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { Drawer, Typography, Space, Tag, Tooltip, Button } from "antd";
import {
    CalendarOutlined,
    EditOutlined,
    EnvironmentOutlined,
    LinkOutlined,
    UserOutlined,
    VideoCameraOutlined,
    TeamOutlined,
    GoogleOutlined,
    PhoneOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ContentRenderer } from "@/Components/ContentRenderer";
import { getStatusColor } from "@/lib/utils";

const { Title, Text } = Typography;

interface Props extends IModalProps {
    deal: Deal;
    followup: DealFollowup;
    onEdit?: () => void;
}

const ViewFollowup: React.FC<Props> = ({
    deal,
    followup,
    onClose,
    open,
    onEdit,
}) => {
    console.log("deal follow up ...", followup);
    const handleEdit = () => {
        onClose();
        if (onEdit) {
            onEdit();
        }
    };

    const getMeetingIcon = (location: string) => {
        switch (location) {
            case "zoom":
                return <VideoCameraOutlined style={{ color: "#2D8CFF" }} />;
            case "teams":
                return <TeamOutlined style={{ color: "#6264A7" }} />;
            case "meet":
                return <GoogleOutlined style={{ color: "#34A853" }} />;
            case "phone":
                return <PhoneOutlined style={{ color: "#FF6B35" }} />;
            default:
                return <EnvironmentOutlined style={{ color: "#666" }} />;
        }
    };

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between">
                    <span>Follow-up Details</span>
                    {onEdit && (
                        <Tooltip title="Edit Follow-up">
                            <EditOutlined
                                className="cursor-pointer text-blue-600 hover:text-blue-800"
                                onClick={handleEdit}
                            />
                        </Tooltip>
                    )}
                </div>
            }
            placement="right"
            size="large"
            open={open}
            onClose={() => onClose()}
            destroyOnHidden
            className="view-followup-drawer"
        >
            <div className="space-y-6">
                {/* Follow-up Overview */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-3">
                        <Title level={3} className="mb-0 text-blue-800">
                            {followup?.meeting_type?.name ||
                                "Follow-up Meeting"}
                        </Title>
                        <Tag
                            color={getStatusColor(followup?.status)}
                            className="px-3 py-1 capitalize"
                        >
                            {followup?.status}
                        </Tag>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                            <CalendarOutlined className="text-blue-600" />
                            <div>
                                <Text strong>Date & Time</Text>
                                <div className="text-sm text-gray-600">
                                    {followup?.next_follow_up_date &&
                                        dayjs(
                                            followup.next_follow_up_date
                                        ).format("MMMM DD, YYYY [at] h:mm A")}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {getMeetingIcon(followup?.location || "")}
                            <div>
                                <Text strong>Location</Text>
                                <div className="text-sm text-gray-600 capitalize">
                                    {followup?.location || "Office"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Meeting Link */}
                {followup?.meeting_link && followup?.location !== "office" && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <Title level={5} className="mb-3 flex items-center">
                            <LinkOutlined className="mr-2 text-green-600" />
                            Meeting Link
                        </Title>
                        <div className="flex items-center space-x-3">
                            <Button
                                type="primary"
                                icon={getMeetingIcon(followup?.location || "")}
                                href={followup?.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center"
                            >
                                Join Meeting
                            </Button>
                            <Text
                                copyable={{ text: followup?.meeting_link }}
                                className="text-gray-500"
                            >
                                {followup?.meeting_link}
                            </Text>
                        </div>
                    </div>
                )}

                {/* Follow-up Summary */}
                <div>
                    <Title level={4} className="mb-3">
                        Summary & Remarks
                    </Title>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px]">
                        {followup?.remark ? (
                            <ContentRenderer
                                content={followup.remark}
                                showFullContent={true}
                                className="prose prose-sm max-w-none"
                            />
                        ) : (
                            <Text type="secondary" italic>
                                No summary or remarks provided
                            </Text>
                        )}
                    </div>
                </div>

                {/* Meeting Summary */}
                {followup?.meeting_summary && (
                    <div>
                        <Title level={4} className="mb-3 flex items-center">
                            <FileTextOutlined className="mr-2 text-green-600" />
                            Meeting Summary
                        </Title>
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-lg p-4">
                            {Object.keys(followup.meeting_summary.summary_object).length > 0 ? (
                                <div className="space-y-4">
                                    {Object.entries(followup.meeting_summary.summary_object).map(([key, value]) => (
                                        <div key={key} className="border-b border-green-100 pb-3 last:border-b-0 last:pb-0">
                                            <Title level={5} className="mb-2 text-green-800 capitalize">
                                                {key.replace(/[_-]/g, ' ')}
                                            </Title>
                                            <div className="text-gray-700">
                                                {value}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="mt-4 pt-3 border-t border-green-100">
                                        <Text type="secondary" className="text-sm">
                                            Summary generated on{" "}
                                            {dayjs(followup.meeting_summary.created_at).format("MMMM DD, YYYY [at] h:mm A")}
                                        </Text>
                                    </div>
                                </div>
                            ) : (
                                <Text type="secondary" italic>
                                    Meeting summary is available but contains no data
                                </Text>
                            )}
                        </div>
                    </div>
                )}

                {/* Follow-up Metadata */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <Title level={5} className="mb-3 text-gray-700">
                        Follow-up Information
                    </Title>
                    <Space direction="vertical" size="small" className="w-full">
                        <div className="flex items-center space-x-2">
                            <CalendarOutlined className="text-gray-500" />
                            <Text type="secondary">
                                Created on{" "}
                                {followup?.created_at &&
                                    dayjs(followup.created_at).format(
                                        "MMMM DD, YYYY [at] h:mm A"
                                    )}
                            </Text>
                        </div>

                        {followup?.updated_at &&
                            followup?.updated_at !== followup?.created_at && (
                                <div className="flex items-center space-x-2">
                                    <EditOutlined className="text-gray-500" />
                                    <Text type="secondary">
                                        Last updated on{" "}
                                        {dayjs(followup.updated_at).format(
                                            "MMMM DD, YYYY [at] h:mm A"
                                        )}
                                    </Text>
                                </div>
                            )}

                        {followup?.added_by && (
                            <div className="flex items-center space-x-2">
                                <UserOutlined className="text-gray-500" />
                                <Text type="secondary">
                                    Scheduled by User: {followup.added_by?.name}
                                </Text>
                            </div>
                        )}
                    </Space>
                </div>

                {/* Related Deal Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                    <Title level={5} className="mb-2 text-blue-800">
                        Related Deal
                    </Title>
                    <div className="space-y-1">
                        <Text strong>{deal?.name}</Text>
                        {deal?.contact && (
                            <div>
                                <Text type="secondary">
                                    Client: {deal?.contact?.client_name}{" "}
                                </Text>
                            </div>
                        )}
                        {deal?.value && (
                            <div>
                                <Text type="secondary">
                                    Value:{" "}
                                    {deal?.currency?.currency_symbol || "$"}
                                    {Number(deal?.value).toLocaleString()}
                                </Text>
                            </div>
                        )}
                        {deal?.lead_stage && (
                            <div>
                                <Text type="secondary">
                                    Stage:{" "}
                                    <Tag color="blue">
                                        {deal?.lead_stage?.name}
                                    </Tag>
                                </Text>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Drawer>
    );
};

export default ViewFollowup;
