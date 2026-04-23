import React from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Card, Input, Empty, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { LeadNote } from "@/Types/api/lead-note";
import { NoteCard } from "./NoteCard";

const { Search } = Input;
const { Title, Text } = Typography;

interface NotesListProps {
    notes: LeadNote[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    permissions: Record<string, string>;
    userId?: number;
    onAddNote: () => void;
    onViewNote: (note: LeadNote) => void;
    onEditNote: (note: LeadNote) => void;
    onDeleteNote: (note: LeadNote) => void;
}

export const NotesList: React.FC<NotesListProps> = ({
    notes,
    searchTerm,
    onSearchChange,
    permissions,
    userId,
    onAddNote,
    onViewNote,
    onEditNote,
    onDeleteNote,
}) => {
    const { t } = useTranslation();
    const canAddNote =
        permissions.add_lead_note === "all" ||
        permissions.add_lead_note === "added" ||
        permissions.add_lead_note === "both";

    // Filter notes based on search term
    const filteredNotes = notes.filter(
        (note) =>
            note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.details?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderAddNoteCard = () => {
        if (!canAddNote) return null;

        return (
            <Card
                className="border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200 cursor-pointer group"
                bodyStyle={{ padding: "32px 24px" }}
                onClick={onAddNote}
                // hoverable
                variant="outlined"
            >
                <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                        <PlusOutlined className="text-blue-600 text-xl" />
                    </div>
                    <Title
                        level={5}
                        className="text-gray-700 group-hover:text-blue-700 transition-colors mb-2"
                    >
                        {t("pages.leads.notes.add_new_title")}
                    </Title>
                    <Text className="text-gray-500">
                        {t("pages.leads.notes.click_to_write")}
                    </Text>
                </div>
            </Card>
        );
    };

    const renderEmptyState = () => {
        return (
            <div className="col-span-full">
                <Empty
                    description={
                        searchTerm
                            ? `${t("pages.leads.notes.no_notes_found")} "${searchTerm}"`
                            : t("pages.leads.notes.no_notes_yet")
                    }
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-y-6">
            {/* Header with Search */}
            <div className="flex justify-end">
                <div className="w-10/12 md:w-1/3 lg:w-4/12">
                    <Search
                        placeholder={t("pages.leads.notes.search_placeholder")}
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        allowClear
                        size="small"
                        // prefix={<SearchOutlined />}
                    />
                </div>
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {/* Add Note Card - Show only when not searching */}
                {!searchTerm && renderAddNoteCard()}

                {/* Notes or Empty State */}
                {filteredNotes.length === 0 &&
                    !canAddNote &&
                    renderEmptyState()}

                {filteredNotes.map((note) => (
                    <NoteCard
                        key={note.id}
                        note={note}
                        permissions={permissions}
                        userId={userId}
                        onView={onViewNote}
                        onEdit={onEditNote}
                        onDelete={onDeleteNote}
                    />
                ))}
            </div>
        </div>
    );
};
