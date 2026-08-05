import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Note } from "@/Types/api/note";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { formatCompanyDateTime } from "@/lib/companyDateTime";

export interface NoteDetailModalLabels {
    viewTitle: string;
    editTitle: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    titleField: string;
    detailsField: string;
    editedTag: string;
    unknownAuthor: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    deleteConfirmLabel: string;
}

interface NoteDetailModalProps {
    note: Note | null;
    onClose: () => void;
    canEdit: boolean;
    canDelete: boolean;
    isUpdating: boolean;
    isDeleting: boolean;
    onUpdate: (
        payload: { title: string; details: string },
        onSuccess?: () => void,
    ) => void;
    onDelete: (onSuccess?: () => void) => void;
    labels: NoteDetailModalLabels;
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export default function NoteDetailModal({
    note,
    onClose,
    canEdit,
    canDelete,
    isUpdating,
    isDeleting,
    onUpdate,
    onDelete,
    labels,
}: NoteDetailModalProps) {
    const { td } = useTd();
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (note) {
            setEditing(false);
            setTitle(note.title);
            setText(stripHtml(note.details || ""));
            setConfirmDelete(false);
        }
    }, [note]);

    if (!note) return null;

    const authorName =
        note.added_by?.name ??
        // Lead notes sometimes only hydrate `added_by_user` on create.
        (note as Note & { added_by_user?: { name?: string } }).added_by_user
            ?.name ??
        labels.unknownAuthor;
    const createdLabel = formatCompanyDateTime(
        note.created_at || note.updated_at || new Date(),
        { fallback: "" },
    );
    const isEdited =
        Boolean(note.updated_at && note.created_at) &&
        note.updated_at !== note.created_at;

    const handleSave = () => {
        if (!text.trim()) return;
        onUpdate(
            {
                title: title.trim(),
                details: `<p>${text.trim()}</p>`,
            },
            () => setEditing(false),
        );
    };

    return (
        <Modal
            open={!!note}
            onClose={onClose}
            title={editing ? labels.editTitle : labels.viewTitle}
            footer={
                editing ? (
                    <>
                        <Button
                            variant="ghost"
                            onClick={() => setEditing(false)}
                        >
                            {labels.cancel}
                        </Button>
                        <Button
                            variant="primary"
                            disabled={!text.trim() || isUpdating}
                            loading={isUpdating}
                            onClick={handleSave}
                        >
                            {labels.save}
                        </Button>
                    </>
                ) : (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 8,
                            width: "100%",
                        }}
                    >
                        {canDelete ? (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setConfirmDelete(true)}
                            >
                                {labels.delete}
                            </Button>
                        ) : (
                            <span />
                        )}
                        {canEdit && (
                            <Button
                                variant="primary"
                                onClick={() => setEditing(true)}
                            >
                                {labels.edit}
                            </Button>
                        )}
                    </div>
                )
            }
        >
            {editing ? (
                <>
                    <ModalField label={labels.titleField}>
                        <input
                            className="dr-input"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                    </ModalField>
                    <ModalField label={labels.detailsField}>
                        <textarea
                            className="dr-input"
                            rows={7}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            style={{
                                resize: "vertical",
                                maxWidth: "100%",
                                wordBreak: "break-word",
                            }}
                        />
                    </ModalField>
                </>
            ) : (
                <>
                    <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-[9px]">
                            <Avatar
                                size={32}
                                initials={initialsFromName(authorName)}
                            />
                            <span className="min-w-0">
                                {note.title?.trim() ? (
                                    <>
                                        <span
                                            className="block text-sm font-semibold"
                                            style={{
                                                overflowWrap: "anywhere",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {td(note.title)}
                                            {isEdited && (
                                                <span
                                                    className="ml-1 text-[12px] font-normal italic"
                                                    style={{ color: T.TEXT_MUTED }}
                                                >
                                                    ({labels.editedTag})
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className="block text-[13px]"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {authorName}
                                        </span>
                                    </>
                                ) : (
                                    <span className="block text-sm font-semibold">
                                        {authorName}
                                        {isEdited && (
                                            <span
                                                className="ml-1 text-[12px] font-normal italic"
                                                style={{ color: T.TEXT_MUTED }}
                                            >
                                                ({labels.editedTag})
                                            </span>
                                        )}
                                    </span>
                                )}
                            </span>
                        </div>
                        {createdLabel ? (
                            <span
                                className="shrink-0 text-[12px]"
                                style={{ color: T.TEXT_MUTED }}
                            >
                                {createdLabel}
                            </span>
                        ) : null}
                    </div>
                    <div
                        className="min-w-0 text-[14px] leading-[1.7] whitespace-pre-wrap"
                        style={{
                            color: T.TEXT,
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                            maxWidth: "100%",
                        }}
                    >
                        {stripHtml(note.details || "")}
                    </div>
                </>
            )}

            <ConfirmDialog
                open={confirmDelete}
                title={labels.deleteConfirmTitle}
                message={labels.deleteConfirmMessage}
                confirmLabel={labels.deleteConfirmLabel}
                danger
                confirmLoading={isDeleting}
                onConfirm={() => {
                    onDelete(() => {
                        setConfirmDelete(false);
                        onClose();
                    });
                }}
                onCancel={() => setConfirmDelete(false)}
            />
        </Modal>
    );
}
