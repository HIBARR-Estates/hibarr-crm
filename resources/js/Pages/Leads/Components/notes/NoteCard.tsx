import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import {
    Card,
    Button,
    Typography,
    Space,
    Dropdown,
    Tag,
    MenuProps,
} from "antd";
import {
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    EyeOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { LeadNote } from "@/Types/api/lead-note";
import { ContentRenderer } from "@/Components/ContentRenderer";
import UserIndicator from "@/Components/UserIndicator";

const { Title } = Typography;

interface NoteCardProps {
    note: LeadNote;
    permissions: Record<string, string>;
    userId?: number;
    onView: (note: LeadNote) => void;
    onEdit: (note: LeadNote) => void;
    onDelete: (note: LeadNote) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
    note,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
}) => {
    const { t } = useTranslation();
    const canEdit =
        permissions.edit_lead_note === "all" ||
        (permissions.edit_lead_note === "added" &&
            note.added_by?.id === userId);

    const canDelete =
        permissions.delete_lead_note === "all" ||
        (permissions.delete_lead_note === "added" &&
            note.added_by?.id === userId);

    const menuItems: MenuProps["items"] = [
        {
            key: "view",
            label: (
                <span>
                    <EyeOutlined className="mr-2" />
                    {t("pages.leads.notes.view_details")}
                </span>
            ),
            onClick: () => onView(note),
        },
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      label: (
                          <span>
                              <EditOutlined className="mr-2" />
                              {t("pages.leads.notes.edit_note")}
                          </span>
                      ),
                      onClick: () => onEdit(note),
                  },
              ]
            : []),
        ...(canDelete
            ? [
                  {
                      type: "divider" as const,
                  },
                  {
                      key: "delete",
                      onClick: () => onDelete(note),
                      label: (
                          <span>
                              <DeleteOutlined className="mr-2" />
                              {t("pages.leads.notes.delete_note")}
                          </span>
                      ),
                      danger: true,
                  },
              ]
            : []),
    ];

    return (
        <Card
            className="group transition-all duration-200 border border-gray-200 hover:border-blue-300 "
            bodyStyle={{ padding: "20px" }}
            // hoverable
            variant="outlined"
        >
            <div className="flex justify-between items-start mb-3 gap-2">
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                        <Title
                            level={5}
                            className="mb-1 text-gray-800 group-hover:text-blue-700 transition-colors cursor-pointer hover:underline hover:text-blue-600"
                            onClick={() => onView(note)}
                            ellipsis={{
                                tooltip: note.title,
                                rows: 1,
                            }}
                        >
                            {note.title}
                        </Title>
                    </div>
                </div>

                {menuItems.length > 1 && (
                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                            className="opacity-80 group-hover:opacity-100 transition-opacity duration-200 text-gray-400 hover:text-gray-600"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </Dropdown>
                )}
            </div>

            <div className="mb-4 h-16 overflow-hidden">
                <ContentRenderer
                    content={note.details}
                    maxLength={120}
                    showFullContent={false}
                    className="text-sm text-gray-600 leading-relaxed"
                />
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    {note.added_by_user && (
                        <UserIndicator data={note.added_by_user} size="xs" />
                    )}
                </div>

                {note.updated_at !== note.created_at && (
                    <Tag color="orange" className="text-xs">
                        {t("pages.leads.notes.view_updated")}
                    </Tag>
                )}
            </div>
            <Space size="small" className="text-xs text-gray-400 mt-2">
                <ClockCircleOutlined />
                <span>{formatCompanyDate(note.created_at)}</span>
            </Space>
        </Card>
    );
};
