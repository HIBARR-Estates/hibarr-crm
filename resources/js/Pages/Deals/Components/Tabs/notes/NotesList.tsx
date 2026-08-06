import React from "react";
import { Card, Button, Input, Empty, Typography, Space } from "antd";
import {
    PlusOutlined,
    SearchOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import { Note } from "@/Types/api/note";
import { NoteCard } from "./NoteCard";
import { NotesBreadcrumb, NotesView } from "./NotesBreadcrumb";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Search } = Input;
const { Title, Text } = Typography;

interface NotesListProps {
    notes: Note[];
    searchTerm: string;
    onSearchChange: (value: string) => void;
    permissions: Record<string, string>;
    userId?: number;
    /** Watcher-only users are read-only on deal notes (matches DealNoteController). */
    isWatcherOnly?: boolean;
    onAddNote: () => void;
    onViewNote: (note: Note) => void;
    onEditNote: (note: Note) => void;
    onDeleteNote: (note: Note) => void;
    currentView: NotesView;
    selectedNote?: Note | null;
    setCurrentView: (view: NotesView) => void;
}

export const NotesList: React.FC<NotesListProps> = ({
    notes,
    searchTerm,
    onSearchChange,
    permissions,
    userId,
    isWatcherOnly = false,
    onAddNote,
    onViewNote,
    onEditNote,
    onDeleteNote,
    currentView,
    selectedNote,
    setCurrentView,
}) => {
    const canAddNote =
        !isWatcherOnly &&
        (permissions.add_deal_note === "all" ||
            permissions.add_deal_note === "added" ||
            permissions.add_deal_note === "both");

    // Filter notes based on search term
    const filteredNotes = notes.filter(
        (note) =>
            note.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            note.details?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const { td } = useTd();

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
                        {td("Add New Note", { source: "en" })}
                    </Title>
                    <Text className="text-gray-500">
                        {td("Click to start writing", { source: "en" })}
                    </Text>
                </div>
            </Card>
        );
    };

    const renderEmptyState = () => {
        return (
            <div className="col-span-full">
                <Empty
                    description={td(searchTerm
                            ? `No notes found for "${searchTerm}"`
                            : "No notes yet", { source: "en" })}
                />
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-y-6">
            {/* Header with Search */}
            <div className="flex justify-between items-center">
                {/* Breadcrumb Navigation */}
                <NotesBreadcrumb
                    currentView={currentView}
                    noteTitle={selectedNote?.title}
                    onNavigate={setCurrentView}
                />
                <div className="w-10/12 md:w-1/3 lg:w-4/12">
                    <Search
                        placeholder="Search notes by title or content..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                        allowClear
                        size="small"
                        // prefix={<SearchOutlined />}
                    />
                </div>
            </div>

            {/* Notes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
                {/* Add Note Card - Show only when there are no notes */}
                {filteredNotes.length === 0 && renderAddNoteCard()}

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
                        isWatcherOnly={isWatcherOnly}
                        onView={onViewNote}
                        onEdit={onEditNote}
                        onDelete={onDeleteNote}
                    />
                ))}
            </div>
        </div>
    );
};
