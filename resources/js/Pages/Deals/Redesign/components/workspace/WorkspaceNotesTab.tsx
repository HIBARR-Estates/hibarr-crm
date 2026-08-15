import { useState } from "react";
import { usePage } from "@inertiajs/react";
import type { Note } from "@/Types/api/note";
import WorkspaceNotesTab from "@/Components/Redesign/workspace/WorkspaceNotesTab";
import { hasNoteScopeAccess } from "@/Components/Redesign/adapters/noteAdapter";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteMutations from "../../hooks/useDealNoteMutations";
import DealNoteDetailModal from "./DealNoteDetailModal";

interface DealWorkspaceNotesTabProps {
    notes: Note[];
    permissions: Record<string, string>;
    onAddNote: () => void;
}

export default function DealWorkspaceNotesTab({
    notes,
    permissions,
    onAddNote,
}: DealWorkspaceNotesTabProps) {
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { deal, setNotes } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { deleteNote, isDeleting } = useDealNoteMutations(confirmDeleteId ?? 0);

    const canAdd =
        !isWatcherOnly &&
        (permissions.add_deal_note === "all" ||
            permissions.add_deal_note === "added" ||
            permissions.add_deal_note === "both");

    const canBulkDelete =
        !isWatcherOnly && permissions.delete_deal_note === "all";

    const isOwner = (note: Note) => note.added_by?.id === userId;

    return (
        <WorkspaceNotesTab
            notes={notes}
            setNotes={setNotes}
            canAdd={canAdd}
            canBulkDelete={canBulkDelete}
            canDeleteNote={(note) =>
                !isWatcherOnly &&
                hasNoteScopeAccess(permissions.delete_deal_note, isOwner(note))
            }
            canEditNote={(note) =>
                !isWatcherOnly &&
                hasNoteScopeAccess(permissions.edit_deal_note, isOwner(note))
            }
            onAddNote={onAddNote}
            bulkActionRoute={route("deal-notes.apply_quick_action")}
            onDeleteNote={deleteNote}
            isDeleting={isDeleting}
            confirmDeleteId={confirmDeleteId}
            setConfirmDeleteId={setConfirmDeleteId}
            renderDetailModal={({ note, onClose, initialEditing }) => (
                <DealNoteDetailModal
                    note={note}
                    permissions={permissions}
                    onClose={onClose}
                    initialEditing={initialEditing}
                />
            )}
        />
    );
}
