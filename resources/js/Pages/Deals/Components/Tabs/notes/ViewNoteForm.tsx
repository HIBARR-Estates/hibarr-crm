import React from "react";
import { Typography, Tag, Modal } from "antd";
import { EditOutlined, DeleteOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/companyDateTime";
import { Note } from "@/Types/api/note";
import { Deal } from "@/Types/api/deals";
import { ContentRenderer } from "@/Components/ContentRenderer";
import UserIndicator from "@/Components/UserIndicator";
import { useTd } from "@/Hooks/useDynamicTranslation";
import "@/Components/Common/note-modal.css";

const { Text } = Typography;

interface ViewNoteFormProps {
    deal: Deal;
    note: Note;
    permissions: Record<string, string>;
    userId?: number;
    isWatcherOnly?: boolean;
    onCancel: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

export const ViewNoteForm: React.FC<ViewNoteFormProps> = ({
    deal,
    note,
    permissions,
    userId,
    isWatcherOnly = false,
    onCancel,
    onEdit,
    onDelete,
}) => {
    const canEdit =
        !isWatcherOnly &&
        (permissions.edit_deal_note === "all" ||
            (permissions.edit_deal_note === "added" && note.added_by === userId));

    const canDelete =
        !isWatcherOnly &&
        (permissions.delete_deal_note === "all" ||
            (permissions.delete_deal_note === "added" &&
                note.added_by === userId));
    const { td } = useTd();

    return (
        <Modal
            className="note-modal"
            title={null}
            open
            onCancel={onCancel}
            footer={null}
            width={700}
            centered
            destroyOnHidden
            closable
        >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-semibold text-gray-900 leading-tight break-words">
                        {td(note.title, { source: "en" })}
                    </h2>
                    {note.updated_at !== note.created_at && (
                        <Tag color="orange" className="shrink-0 mt-1">
                            {td("Updated", { source: "en" })}{" "}
                            {formatCompanyDate(note.updated_at)}
                        </Tag>
                    )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                        <ClockCircleOutlined />
                        {td("Created", { source: "en" })}{" "}
                        {formatCompanyDateTime(note.created_at, {
                            separator: " at ",
                        })}
                    </span>
                    {note.added_by && (
                        <UserIndicator
                            data={note.added_by}
                            size="sm"
                            maxNameLength={300}
                        />
                    )}
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
                {note.details ? (
                    <ContentRenderer
                        content={note.details}
                        showFullContent={true}
                        className="prose prose-sm max-w-none text-gray-700"
                    />
                ) : (
                    <Text type="secondary" italic className="text-base">
                        {td("No content provided for this note.", { source: "en" })}
                    </Text>
                )}
            </div>

            {/* Footer */}
            {(canEdit || canDelete) && (
                <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-3">
                    {canDelete && (
                        <button
                            onClick={onDelete}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            <DeleteOutlined />
                            {td("Delete", { source: "en" })}
                        </button>
                    )}
                    {canEdit && (
                        <button
                            onClick={onEdit}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 active:scale-[0.98] transition-all"
                        >
                            <EditOutlined />
                            {td("Edit", { source: "en" })}
                        </button>
                    )}
                </div>
            )}
        </Modal>
    );
};
