import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import NoteDetailModal from "@/Components/Redesign/modals/NoteDetailModal";
import type { LeadNote } from "@/Types/api/lead-note";
import useLeadNoteMutations from "../../hooks/useLeadNoteMutations";

interface LeadNoteDetailModalProps {
    note: LeadNote | null;
    permissions?: Record<string, string>;
    onClose: () => void;
}

// Permission scopes are "all" | "added" | "owned" | "both" | "none" — "added"/"owned" both
// mean "only your own notes", "both" behaves as "all".
function hasNoteScopeAccess(scope: string | undefined, isOwner: boolean): boolean {
    return (
        scope === "all" ||
        scope === "both" ||
        ((scope === "added" || scope === "owned") && isOwner)
    );
}

function canEditNote(
    note: LeadNote,
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return true;
    const isOwner =
        note.added_by?.id === userId || note.added_by_user?.id === userId;
    return hasNoteScopeAccess(permissions.edit_lead_note, isOwner);
}

function canDeleteNote(
    note: LeadNote,
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return true;
    const isOwner =
        note.added_by?.id === userId || note.added_by_user?.id === userId;
    return hasNoteScopeAccess(permissions.delete_lead_note, isOwner);
}

export default function LeadNoteDetailModal({
    note,
    permissions,
    onClose,
}: LeadNoteDetailModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { updateNote, isUpdating, deleteNote, isDeleting } =
        useLeadNoteMutations(note?.id ?? 0);

    const canEdit = note ? canEditNote(note, permissions, userId) : false;
    const canDelete = note ? canDeleteNote(note, permissions, userId) : false;

    return (
        <NoteDetailModal
            note={note}
            onClose={onClose}
            canEdit={canEdit}
            canDelete={canDelete}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            onUpdate={(payload, onSuccess) => updateNote(payload, onSuccess)}
            onDelete={(onSuccess) => deleteNote(onSuccess)}
            labels={{
                viewTitle: t("pages.deals.workspace.notes.view_title"),
                editTitle: t("pages.deals.workspace.notes.edit_note"),
                cancel: t("pages.deals.common.cancel"),
                save: t("pages.deals.common.save_changes"),
                delete: t("pages.deals.common.delete"),
                edit: t("pages.deals.workspace.notes.edit_note"),
                titleField: t("pages.deals.workspace.notes.title_label"),
                detailsField: t("pages.deals.workspace.notes.details_label"),
                editedTag: t("pages.deals.workspace.notes.edited_tag"),
                unknownAuthor: t(
                    "pages.deals.workspace.notes.unknown_author",
                ),
                deleteConfirmTitle: t(
                    "pages.deals.workspace.notes.delete_confirm_title",
                ),
                deleteConfirmMessage: t(
                    "pages.deals.workspace.notes.delete_single_confirm_message",
                ),
                deleteConfirmLabel: t(
                    "pages.deals.workspace.notes.delete_note",
                ),
            }}
        />
    );
}
