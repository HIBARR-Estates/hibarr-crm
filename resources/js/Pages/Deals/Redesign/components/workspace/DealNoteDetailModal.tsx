import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { Note } from "@/Types/api/note";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import { DealModal, DealModalField } from "../primitives/DealModal";
import useDealNoteMutations from "../../hooks/useDealNoteMutations";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { initialsFromName } from "../../adapters/initials";

interface DealNoteDetailModalProps {
    note: Note | null;
    permissions: Record<string, string>;
    onClose: () => void;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** Ported from v2.2's NoteDetailModal (deal-v2-2.jsx:1695-1771). */
export default function DealNoteDetailModal({
    note,
    permissions,
    onClose,
}: DealNoteDetailModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { deal } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const { updateNote, isUpdating, deleteNote, isDeleting } = useDealNoteMutations(
        note?.id ?? 0,
    );

    useEffect(() => {
        if (note) {
            setEditing(false);
            setTitle(note.title);
            setText(stripHtml(note.details || ""));
            setConfirmDelete(false);
        }
    }, [note]);

    if (!note) return null;

    const canEdit =
        !isWatcherOnly &&
        (permissions.edit_deal_note === "all" ||
            (permissions.edit_deal_note === "added" &&
                note.added_by?.id === userId));
    const canDelete =
        !isWatcherOnly &&
        (permissions.delete_deal_note === "all" ||
            (permissions.delete_deal_note === "added" &&
                note.added_by?.id === userId));

    const handleSave = () => {
        if (!text.trim()) return;
        updateNote(
            {
                // Clearing the title should clear it, not silently revert to
                // the previous value — title is a nullable field server-side.
                title: title.trim(),
                details: `<p>${text.trim()}</p>`,
            },
            () => setEditing(false),
        );
    };

    return (
        <DealModal
            open={!!note}
            onClose={onClose}
            title={
                editing
                    ? t("pages.deals.workspace.notes.edit_note")
                    : t("pages.deals.workspace.notes.view_title")
            }
            footer={
                editing ? (
                    <>
                        <DealButton variant="ghost" onClick={() => setEditing(false)}>
                            {t("pages.deals.common.cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            disabled={!text.trim() || isUpdating}
                            loading={isUpdating}
                            onClick={handleSave}
                        >
                            {t("pages.deals.common.save_changes")}
                        </DealButton>
                    </>
                ) : (
                    <>
                        {canDelete && (
                            <DealButton
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setConfirmDelete(true)}
                            >
                                {t("pages.deals.common.delete")}
                            </DealButton>
                        )}
                        <span style={{ flex: 1 }} />
                        {canEdit && (
                            <DealButton variant="primary" onClick={() => setEditing(true)}>
                                {t("pages.deals.workspace.notes.edit_note")}
                            </DealButton>
                        )}
                    </>
                )
            }
        >
            {editing ? (
                <>
                    <DealModalField label={t("pages.deals.workspace.notes.title_label")}>
                        <input
                            className="dr-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </DealModalField>
                    <DealModalField label={t("pages.deals.workspace.notes.details_label")}>
                        <textarea
                            className="dr-input"
                            rows={7}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            style={{ resize: "vertical" }}
                        />
                    </DealModalField>
                </>
            ) : (
                <>
                    <div className="mb-4 flex items-center gap-[9px]">
                        <DealAvatar
                            size={32}
                            initials={initialsFromName(note.added_by?.name)}
                        />
                        <span className="min-w-0">
                            {note.title?.trim() ? (
                                <>
                                    <span className="block text-sm font-semibold">
                                        {td(note.title)}
                                        {note.updated_at !== note.created_at && (
                                            <span
                                                className="ml-1 text-[12px] font-normal italic"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                ({t("pages.deals.workspace.notes.edited_tag")})
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className="block text-[13px]"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {note.added_by?.name ??
                                            t("pages.deals.workspace.notes.unknown_author")}
                                    </span>
                                </>
                            ) : (
                                <span className="block text-sm font-semibold">
                                    {note.added_by?.name ??
                                        t("pages.deals.workspace.notes.unknown_author")}
                                    {note.updated_at !== note.created_at && (
                                        <span
                                            className="ml-1 text-[12px] font-normal italic"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            ({t("pages.deals.workspace.notes.edited_tag")})
                                        </span>
                                    )}
                                </span>
                            )}
                        </span>
                    </div>
                    <div
                        className="text-[14px] leading-[1.7] break-words whitespace-pre-wrap"
                        style={{ color: T.TEXT }}
                   
                    >
                        {stripHtml(note.details || "")}
                    </div>
                </>
            )}

            <DealConfirmDialog
                open={confirmDelete}
                title={t("pages.deals.workspace.notes.delete_confirm_title")}
                message={t(
                    "pages.deals.workspace.notes.delete_single_confirm_message",
                )}
                confirmLabel={t("pages.deals.workspace.notes.delete_note")}
                danger
                confirmLoading={isDeleting}
                onConfirm={() => {
                    deleteNote(() => {
                        setConfirmDelete(false);
                        onClose();
                    });
                }}
                onCancel={() => setConfirmDelete(false)}
            />
        </DealModal>
    );
}
