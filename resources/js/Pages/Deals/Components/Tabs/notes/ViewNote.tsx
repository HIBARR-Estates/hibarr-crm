import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { IModalProps } from "@/Types/common";
import { Drawer, Typography, Space, Tag, Avatar, Tooltip } from "antd";
import {
    UserOutlined,
    CalendarOutlined,
    EditOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ContentRenderer } from "@/Components/ContentRenderer";

const { Title, Text } = Typography;

interface Props extends IModalProps {
    deal: Deal;
    note: Note;
    onEdit?: () => void;
}

const ViewNote: React.FC<Props> = ({ deal, note, onClose, open, onEdit }) => {
    const handleEdit = () => {
        onClose();
        if (onEdit) {
            onEdit();
        }
    };

    return (
        <Drawer
            title={
                <div className="flex items-center justify-between">
                    <span className="text-sm">View Note</span>
                    {onEdit && (
                        <Tooltip title="Edit Note">
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
            className="view-note-drawer"
        >
            <div className="space-y-6">
                {/* Note Title */}
                <div>
                    <Title level={3} className="mb-0">
                        {note.title}
                    </Title>
                </div>

                {/* Note Metadata */}
                <div className="bg-gray-50 p-4 rounded-lg">
                    <Space direction="vertical" size="small" className="w-full">
                        <div className="flex items-center space-x-2">
                            <CalendarOutlined className="text-gray-500" />
                            <Text type="secondary">
                                Created on{" "}
                                {dayjs(note.created_at).format(
                                    "MMMM DD, YYYY [at] h:mm A"
                                )}
                            </Text>
                        </div>

                        {note.updated_at &&
                            note.updated_at !== note.created_at && (
                                <div className="flex items-center gap-x-2">
                                    <EditOutlined className="text-gray-500" />
                                    <Text type="secondary">
                                        Last updated on{" "}
                                        {dayjs(note.updated_at).format(
                                            "MMMM DD, YYYY [at] h:mm A"
                                        )}
                                    </Text>
                                </div>
                            )}

                        {note.added_by && (
                            <div className="flex items-center gap-x-2">
                                <Avatar
                                    size="small"
                                    icon={<UserOutlined />}
                                    src={note.added_by?.image_url}
                                />
                                <Text type="secondary">
                                    Created by {note.added_by?.name}
                                </Text>
                            </div>
                        )}
                    </Space>
                </div>

                {/* Note Content */}
                <div>
                    <Title level={4} className="mb-3">
                        Details
                    </Title>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 min-h-[200px]">
                        {note.details ? (
                            <ContentRenderer
                                content={note.details}
                                showFullContent={true}
                                className="prose prose-sm max-w-none"
                            />
                        ) : (
                            <Text type="secondary" italic>
                                No details provided
                            </Text>
                        )}
                    </div>
                </div>

                {/* Deal Information */}
                <div className="bg-blue-50 p-4 rounded-lg">
                    <Title level={5} className="mb-2 text-blue-800">
                        Related Deal
                    </Title>
                    <div className="space-y-1">
                        <Text strong>{deal.name}</Text>
                        {deal.contact && (
                            <div>
                                <Text type="secondary">
                                    Client: {deal.contact.client_name}
                                </Text>
                            </div>
                        )}
                        {deal.value && (
                            <div>
                                <Text type="secondary">
                                    Value:{" "}
                                    {deal.currency?.currency_symbol || "$"}
                                    {Number(deal.value).toLocaleString()}
                                </Text>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Drawer>
    );
};

export default ViewNote;
