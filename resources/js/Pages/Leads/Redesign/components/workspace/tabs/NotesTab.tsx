import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    AddNoteModal,
    Button,
    EmptyState,
    Icon,
    NoteDetailModal,
} from "@/Components/Redesign";
import type { AddNoteFormState } from "@/Components/Redesign/modals/AddNoteModal";
import type { LeadNote } from "@/Types/api/lead-note";
import { toLeadNotePreview } from "../../../adapters/noteAdapter";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadNoteCreate from "../../../hooks/useLeadNoteCreate";
import NoteCard from "../cards/NoteCard";

export default function NotesTab() {
    const { td } = useTd();
    const { lead, notes, addNote } = useLeadWorkspace();
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedNote, setSelectedNote] = useState<LeadNote | null>(null);

    const { createNote, isSaving, errors, clearErrors } = useLeadNoteCreate(
        lead.id,
    );

    const noteItems = useMemo(
        () => notes.map((note) => toLeadNotePreview(note)),
        [notes],
    );

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-[#6b7280]">
                    {noteItems.length} note{noteItems.length === 1 ? "" : "s"}
                </span>
                <Button
                    variant="primary"
                    icon={<Icon name="plus" size={14} />}
                    onClick={() => {
                        clearErrors();
                        setModalOpen(true);
                    }}
                >
                    {td("Add note")}
                </Button>
            </div>

            {noteItems.length === 0 ? (
                <EmptyState
                    title={td("No notes yet")}
                    description={td(
                        "Capture call summaries, objections, and next steps.",
                    )}
                />
            ) : (
                noteItems.map((note) => {
                    const raw = notes.find((n) => n.id === note.id);
                    return (
                        <NoteCard
                            key={note.id}
                            note={note}
                            onClick={() => raw && setSelectedNote(raw)}
                        />
                    );
                })
            )}

            <AddNoteModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                saving={isSaving}
                errors={errors}
                onSubmit={(form: AddNoteFormState) =>
                    createNote({ text: form.text || form.title }, (note) => {
                        addNote(note);
                        setModalOpen(false);
                    })
                }
                labels={{
                    title: td("Add note"),
                    cancel: td("Cancel"),
                    submit: td("Save note"),
                    titleField: td("Title"),
                    titlePlaceholder: td("Optional title"),
                    detailsField: td("Details"),
                    bodyPlaceholder: td("Write your note…"),
                }}
            />

            <NoteDetailModal
                note={selectedNote}
                onClose={() => setSelectedNote(null)}
                canEdit={false}
                canDelete={false}
                isUpdating={false}
                isDeleting={false}
                onUpdate={() => {}}
                onDelete={() => {}}
                labels={{
                    viewTitle: td("Note"),
                    editTitle: td("Edit note"),
                    cancel: td("Cancel"),
                    save: td("Save"),
                    delete: td("Delete"),
                    edit: td("Edit"),
                    titleField: td("Title"),
                    detailsField: td("Details"),
                    editedTag: td("Edited"),
                    unknownAuthor: td("Unknown"),
                    deleteConfirmTitle: td("Delete note?"),
                    deleteConfirmMessage: td("This cannot be undone."),
                    deleteConfirmLabel: td("Delete"),
                }}
            />
        </div>
    );
}
