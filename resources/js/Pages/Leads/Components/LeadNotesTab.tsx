import React, { useEffect, useState } from "react";
import { Lead } from "@/Types/api/leads";
import { LeadNote } from "@/Types/api/lead-note";
import { usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";

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
    /** When true, header/search/add stay visible; only the notes grid shows a loader. */
    isLoading?: boolean;
}

export default function LeadNotesTab({
    lead,
    notes = [],
    permissions = {},
    isLoading = false,
}: Props) {
    const { props } = usePage();
    const user = props.auth.user;

    const [localNotes, setLocalNotes] = useState<LeadNote[]>(notes);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentView, setCurrentView] = useState<NotesView>("list");
    const [viewingNote, setViewingNote] = useState<LeadNote | null>(null);
    const [editingNote, setEditingNote] = useState<LeadNote | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    useEffect(() => {
        if (!isLoading) {
            setLocalNotes(notes);
        }
    }, [notes, isLoading]);

    const {
        handleAction,
        action,
        handleClose,
        selected: noteToDelete,
    } = useGenericEntityAction<LeadNote>();

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

    const handleEditFromView = () => {
        if (viewingNote) {
            setEditingNote(viewingNote);
            setViewingNote(null);
        }
    };

    const handleDeleteFromView = () => {
        if (viewingNote) {
            handleAction("delete", viewingNote);
            setViewingNote(null);
        }
    };

    const handleNoteCreated = (note: LeadNote) => {
        setLocalNotes((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
    };

    const handleNoteUpdated = (note: LeadNote) => {
        setLocalNotes((prev) =>
            prev.map((n) => (n.id === note.id ? note : n)),
        );
        setViewingNote((current) =>
            current?.id === note.id ? note : current,
        );
    };

    const handleNoteDeleted = (noteId: number) => {
        setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
        setViewingNote((current) =>
            current?.id === noteId ? null : current,
        );
        setEditingNote((current) =>
            current?.id === noteId ? null : current,
        );
    };

    return (
        <div className="bg-gray-50 p-6 flex flex-col gap-y-6">
            <NotesList
                notes={localNotes}
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
                isLoading={isLoading}
            />

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

            {isAddModalOpen && (
                <AddNoteForm
                    lead={lead}
                    onCancel={() => setIsAddModalOpen(false)}
                    onCreated={handleNoteCreated}
                />
            )}

            {editingNote && (
                <EditNoteForm
                    lead={lead}
                    note={editingNote}
                    onCancel={() => setEditingNote(null)}
                    onUpdated={handleNoteUpdated}
                />
            )}

            <DeleteNote
                open={action === "delete"}
                onClose={() => handleClose()}
                note={noteToDelete}
                onDeleted={handleNoteDeleted}
            />
        </div>
    );
}
