import React from "react";
import { Card, Button, Typography, Tag, Divider, Space } from "antd";
import {
    ArrowLeftOutlined,
    EditOutlined,
    DeleteOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { LeadNote } from "@/Types/api/lead-note";
import { Lead } from "@/Types/api/leads";
import { ContentRenderer } from "@/Components/ContentRenderer";
import UserIndicator from "@/Components/UserIndicator";

const { Title, Text } = Typography;

interface ViewNoteFormProps {
    lead: Lead;
    note: LeadNote;
    permissions: Record<string, string>;
    userId?: number;
    onCancel: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export const ViewNoteForm: React.FC<ViewNoteFormProps> = ({
    lead,
    note,
    permissions,
    userId,
    onCancel,
    onEdit,
    onDelete,
}) => {
    const canEdit =
        permissions.edit_lead_note === "all" ||
        (permissions.edit_lead_note === "added" &&
            note.added_by?.id === userId);

    const canDelete =
        permissions.delete_lead_note === "all" ||
        (permissions.delete_lead_note === "added" &&
            note.added_by?.id === userId);

    return (
        <div className="">
            <Card
                className="shadow-sm border border-gray-200"
                bodyStyle={{ padding: "32px" }}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center">
                        <Button
                            type="text"
                            size="small"
                            icon={<ArrowLeftOutlined />}
                            onClick={onCancel}
                            className="text-gray-600 hover:text-gray-800 -ml-2"
                        />
                        <span className="text-lg font-medium ml-2 text-gray-500">
                            {note.title}
                        </span>
                    </div>

                    <div className="flex items-center space-x-2">
                        {canEdit && (
                            <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={onEdit}
                                className="border-blue-300 text-blue-600 hover:border-blue-500 hover:text-blue-700"
                            />
                        )}
                        {canDelete && (
                            <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={onDelete}
                                danger
                                className="hover:bg-red-50"
                            />
                        )}
                    </div>
                </div>

                {/* Note Title */}
                <div className="mb-8">
                    {/* Metadata */}
                    <div className="flex flex-wrap justify-between items-center gap-6 text-sm text-gray-500">
                        <Space>
                            <ClockCircleOutlined />
                            <span>
                                Created{" "}
                                {dayjs(note.created_at).format(
                                    "MMMM DD, YYYY at HH:mm"
                                )}
                            </span>
                        </Space>

                        {note.added_by_user && (
                            <Space>
                                <UserIndicator
                                    data={note.added_by_user}
                                    size="sm"
                                    maxNameLength={300}
                                />
                            </Space>
                        )}

                        {note.updated_at !== note.created_at && (
                            <Tag color="orange">
                                Updated{" "}
                                {dayjs(note.updated_at).format("MMM DD, YYYY")}
                            </Tag>
                        )}
                    </div>
                </div>

                <Divider />

                {/* Note Content */}
                <div className="mb-8">
                    <Title level={5} className="mb-4 text-gray-800">
                        Note Content
                    </Title>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 min-h-[200px]">
                        {note.details ? (
                            <ContentRenderer
                                content={note.details}
                                showFullContent={true}
                                className="prose prose-sm max-w-none text-gray-700"
                            />
                        ) : (
                            <Text type="secondary" italic className="text-base">
                                No content provided for this note.
                            </Text>
                        )}
                    </div>
                </div>

                <Divider />
            </Card>
        </div>
    );
};
