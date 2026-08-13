import { useState } from "react";
import { usePage } from "@inertiajs/react";
import WorkspaceNotesTab from "@/Components/Redesign/workspace/WorkspaceNotesTab";
import { hasNoteScopeAccess } from "@/Components/Redesign/adapters/noteAdapter";
import type { LeadNote } from "@/Types/api/lead-note";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadNoteMutations from "../../../hooks/useLeadNoteMutations";
import LeadNoteDetailModal from "../LeadNoteDetailModal";

interface NotesTabProps {
    permissions?: Record<string, string>;
    onAddNote: () => void;
}

function noteOwnerId(note: LeadNote): number | undefined {
    return note.added_by?.id ?? note.added_by_user?.id;
}

export default function NotesTab({ permissions, onAddNote }: NotesTabProps) {
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { notes, setNotes } = useLeadWorkspace();
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { deleteNote, isDeleting } = useLeadNoteMutations(confirmDeleteId ?? 0);

    const canAdd =
        !permissions ||
        permissions.add_lead_note === "all" ||
        permissions.add_lead_note === "added" ||
        permissions.add_lead_note === "both";

    const canBulkDelete =
        !permissions || permissions.delete_lead_note === "all";

    const isOwner = (note: LeadNote) => noteOwnerId(note) === userId;

    return (
        <WorkspaceNotesTab
            notes={notes}
            setNotes={setNotes}
            canAdd={canAdd}
            canBulkDelete={canBulkDelete}
            canDeleteNote={(note) =>
                !permissions ||
                hasNoteScopeAccess(permissions.delete_lead_note, isOwner(note))
            }
            canEditNote={(note) =>
                !permissions ||
                hasNoteScopeAccess(permissions.edit_lead_note, isOwner(note))
            }
            onAddNote={onAddNote}
            bulkActionRoute={route("lead-notes.apply_quick_action")}
            onDeleteNote={deleteNote}
            isDeleting={isDeleting}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            renderDetailModal={({ note, onClose, initialEditing }) => (
                <LeadNoteDetailModal
                    note={note}
                    permissions={permissions}
                    onClose={onClose}
                    initialEditing={initialEditing}
                />
            )}
        />
    );
}
