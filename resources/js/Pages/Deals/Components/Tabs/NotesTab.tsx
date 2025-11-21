import React, { useState } from "react";
import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";

// Modular Components
import { NotesBreadcrumb, NotesView } from "./notes/NotesBreadcrumb";
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
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    const {
        handleAction,
        action,
        handleClose,
        selected: noteToDelete,
    } = useGenericEntityAction<Note>();

    // Navigation handlers
    const handleNavigateToList = () => {
        setCurrentView("list");
        setSelectedNote(null);
        setSearchTerm("");
    };

    const handleNavigateToAdd = () => {
        setCurrentView("add");
        setSelectedNote(null);
    };

    const handleNavigateToView = (note: Note) => {
        setSelectedNote(note);
        setCurrentView("view");
    };

    const handleNavigateToEdit = (note: Note) => {
        setSelectedNote(note);
        setCurrentView("edit");
    };

    const handleDeleteNote = (note: Note) => {
        handleAction("delete", note);
    };

    // Edit note from view
    const handleEditFromView = () => {
        if (selectedNote) {
            setCurrentView("edit");
        }
    };

    // Delete note from view
    const handleDeleteFromView = () => {
        if (selectedNote) {
            handleAction("delete", selectedNote);
        }
    };

    const renderCurrentView = () => {
        switch (currentView) {
            case "add":
                return (
                    <AddNoteForm deal={deal} onCancel={handleNavigateToList} />
                );

            case "edit":
                return selectedNote ? (
                    <EditNoteForm
                        deal={deal}
                        note={selectedNote}
                        onCancel={handleNavigateToList}
                    />
                ) : (
                    <div>Note not found</div>
                );

            case "view":
                return selectedNote ? (
                    <ViewNoteForm
                        deal={deal}
                        note={selectedNote}
                        permissions={permissions}
                        userId={user?.id}
                        onCancel={handleNavigateToList}
                        onEdit={handleEditFromView}
                        onDelete={handleDeleteFromView}
                    />
                ) : (
                    <div>Note not found</div>
                );

            case "list":
            default:
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
                    />
                );
        }
    };

    return (
        <div className="bg-gray-50 p-6 flex flex-col gap-y-6">
            {/* Breadcrumb Navigation */}
            <NotesBreadcrumb
                currentView={currentView}
                noteTitle={selectedNote?.title}
                onNavigate={setCurrentView}
            />

            {/* Current View Content */}
            {renderCurrentView()}

            {/* Delete Confirmation Modal */}
            <DeleteNote
                open={action === "delete"}
                onClose={() => handleClose()}
                note={noteToDelete}
            />
        </div>
    );
}
