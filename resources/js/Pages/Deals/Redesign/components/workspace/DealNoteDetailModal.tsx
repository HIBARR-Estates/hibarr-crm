import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { Note } from "@/Types/api/note";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import { DealModal, DealModalField } from "../primitives/DealModal";
import useDealNoteMutations from "../../hooks/useDealNoteMutations";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealNoteDetailModalProps {
    note: Note | null;
    permissions: Record<string, string>;
    onClose: () => void;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/** Ported from v2.2's NoteDetailModal (deal-v2-2.jsx:1695-1771). */
export default function DealNoteDetailModal({
    note,
    permissions,
    onClose,
}: DealNoteDetailModalProps) {
    const { td } = useTd();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
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
        permissions.edit_deal_note === "all" ||
        (permissions.edit_deal_note === "added" && note.added_by?.id === userId);
    const canDelete =
        permissions.delete_deal_note === "all" ||
        (permissions.delete_deal_note === "added" && note.added_by?.id === userId);

    const handleSave = () => {
        if (!text.trim()) return;
        updateNote(
            {
                title: title.trim() || note.title,
                details: `<p>${text.trim()}</p>`,
            },
            () => setEditing(false),
        );
    };

    return (
        <DealModal
            open={!!note}
            onClose={onClose}
            title={editing ? td("Edit note") : td("Note")}
            footer={
                editing ? (
                    <>
                        <DealButton variant="ghost" onClick={() => setEditing(false)}>
                            {td("Cancel")}
                        </DealButton>
                        <DealButton
                            variant="primary"
                            disabled={!text.trim() || isUpdating}
                            loading={isUpdating}
                            onClick={handleSave}
                        >
                            {td("Save changes")}
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
                                {td("Delete")}
                            </DealButton>
                        )}
                        <span style={{ flex: 1 }} />
                        <DealButton variant="ghost" onClick={onClose}>
                            {td("Close")}
                        </DealButton>
                        {canEdit && (
                            <DealButton variant="primary" onClick={() => setEditing(true)}>
                                {td("Edit note")}
                            </DealButton>
                        )}
                    </>
                )
            }
        >
            {editing ? (
                <>
                    <DealModalField label={td("Title")}>
                        <input
                            className="dr-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </DealModalField>
                    <DealModalField label={td("Details")}>
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
                            <span className="block text-sm font-semibold">
                                {td(note.title)}
                                {note.updated_at !== note.created_at && (
                                    <span
                                        className="ml-1 text-[11px] font-normal italic"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        ({td("edited")})
                                    </span>
                                )}
                            </span>
                            <span
                                className="block text-xs"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {note.added_by?.name ?? td("Unknown")}
                            </span>
                        </span>
                    </div>
                    <div
                        className="text-[13px] leading-[1.7]"
                        style={{ color: T.TEXT, whiteSpace: "pre-wrap" }}
                    >
                        {stripHtml(note.details || "")}
                    </div>
                </>
            )}

            <DealConfirmDialog
                open={confirmDelete}
                title={td("Delete note?")}
                message={td(
                    "This note will be permanently removed from the deal. This cannot be undone.",
                )}
                confirmLabel={td("Delete note")}
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
