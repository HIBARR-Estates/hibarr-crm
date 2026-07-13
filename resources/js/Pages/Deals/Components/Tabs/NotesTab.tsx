import React, { useState } from "react";
import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";

// Modular Components
import { NotesView } from "./notes/NotesBreadcrumb";
import { NotesList } from "./notes/NotesList";
import { AddNoteForm } from "./notes/AddNoteForm";
import { EditNoteForm } from "./notes/EditNoteForm";
import { ViewNoteForm } from "./notes/ViewNoteForm";
import DeleteNote from "./notes/DeleteNote";

interface Props {
    deal: Deal;
    notes: Note[];
    permissions: Record<string, string>;
}

export default function NotesTab({ deal, notes, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;

    const [searchTerm, setSearchTerm] = useState("");
    const [currentView, setCurrentView] = useState<NotesView>("list");
    const [viewingNote, setViewingNote] = useState<Note | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const {
        handleAction,
        action,
        handleClose,
        selected: noteToDelete,
    } = useGenericEntityAction<Note>();

    // Navigation handlers
    const handleNavigateToAdd = () => {
        setIsAddModalOpen(true);
    };

    const handleNavigateToView = (note: Note) => {
        setViewingNote(note);
    };

    const handleNavigateToEdit = (note: Note) => {
        setEditingNote(note);
    };

    const handleDeleteNote = (note: Note) => {
        handleAction("delete", note);
    };

    // Edit note from view
    const handleEditFromView = () => {
        if (viewingNote) {
            setEditingNote(viewingNote);
            setViewingNote(null);
        }
    };

    // Delete note from view
    const handleDeleteFromView = () => {
        if (viewingNote) {
            handleAction("delete", viewingNote);
            setViewingNote(null);
        }
    };

    const renderCurrentView = () => {
        return (
            <NotesList
                notes={notes}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                permissions={permissions}
                userId={user?.id}
                onAddNote={handleNavigateToAdd}
                onViewNote={handleNavigateToView}
                onEditNote={handleNavigateToEdit}
                onDeleteNote={handleDeleteNote}
                currentView={currentView}
                setCurrentView={setCurrentView}
            />
        );
    };

    return (
        <div className="bg-gray-50 p-6 flex flex-col gap-y-6 h-full">
            {/* Current View Content */}
            {renderCurrentView()}

            {/* Note Detail Modal */}
            {viewingNote && (
                <ViewNoteForm
                    deal={deal}
                    note={viewingNote}
                    permissions={permissions}
                    userId={user?.id}
                    onCancel={() => setViewingNote(null)}
                    onEdit={handleEditFromView}
                    onDelete={handleDeleteFromView}
                />
            )}

            {/* Add Note Modal */}
            {isAddModalOpen && (
                <AddNoteForm
                    deal={deal}
                    onCancel={() => setIsAddModalOpen(false)}
                />
            )}

            {/* Edit Note Modal */}
            {editingNote && (
                <EditNoteForm
                    deal={deal}
                    note={editingNote}
                    onCancel={() => setEditingNote(null)}
                />
            )}

            {/* Delete Confirmation Modal */}
            <DeleteNote
                open={action === "delete"}
                onClose={() => handleClose()}
                note={noteToDelete}
            />
        </div>
    );
}
