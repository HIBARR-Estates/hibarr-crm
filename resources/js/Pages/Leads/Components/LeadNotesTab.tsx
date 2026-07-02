import React, { useState } from "react";
import { Lead } from "@/Types/api/leads";
import { LeadNote } from "@/Types/api/lead-note";
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
    lead: Lead;
    notes: LeadNote[];
    permissions: Record<string, string>;
}

export default function LeadNotesTab({ lead, notes, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;

    const [searchTerm, setSearchTerm] = useState("");
    const [currentView, setCurrentView] = useState<NotesView>("list");
    const [viewingNote, setViewingNote] = useState<LeadNote | null>(null);
    const [editingNote, setEditingNote] = useState<LeadNote | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const {
        handleAction,
        action,
        handleClose,
        selected: noteToDelete,
    } = useGenericEntityAction<LeadNote>();

    // Navigation handlers
    const handleNavigateToAdd = () => {
        setIsAddModalOpen(true);
    };

    const handleNavigateToView = (note: LeadNote) => {
        setViewingNote(note);
    };

    const handleNavigateToEdit = (note: LeadNote) => {
        setEditingNote(note);
    };

    const handleDeleteNote = (note: LeadNote) => {
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
        <div className="bg-gray-50 p-6 flex flex-col gap-y-6">
            {/* Current View Content */}
            {renderCurrentView()}

            {/* Note Detail Modal */}
            {viewingNote && (
                <ViewNoteForm
                    lead={lead}
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
                    lead={lead}
                    onCancel={() => setIsAddModalOpen(false)}
                />
            )}

            {/* Edit Note Modal */}
            {editingNote && (
                <EditNoteForm
                    lead={lead}
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
