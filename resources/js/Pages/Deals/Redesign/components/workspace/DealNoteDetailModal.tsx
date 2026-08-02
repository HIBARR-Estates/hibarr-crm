import { usePage } from "@inertiajs/react";
import type { Note } from "@/Types/api/note";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import NoteDetailModal from "@/Components/Redesign/modals/NoteDetailModal";
import useDealNoteMutations from "../../hooks/useDealNoteMutations";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";

interface DealNoteDetailModalProps {
    note: Note | null;
    permissions: Record<string, string>;
    onClose: () => void;
}

export default function DealNoteDetailModal({
    note,
    permissions,
    onClose,
}: DealNoteDetailModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { deal } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const { updateNote, isUpdating, deleteNote, isDeleting } =
        useDealNoteMutations(note?.id ?? 0);

    const canEdit =
        !isWatcherOnly &&
        (permissions.edit_deal_note === "all" ||
            (permissions.edit_deal_note === "added" &&
                note?.added_by?.id === userId));
    const canDelete =
        !isWatcherOnly &&
        (permissions.delete_deal_note === "all" ||
            (permissions.delete_deal_note === "added" &&
                note?.added_by?.id === userId));

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
