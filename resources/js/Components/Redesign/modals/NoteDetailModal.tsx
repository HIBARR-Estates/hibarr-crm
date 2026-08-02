import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Note } from "@/Types/api/note";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";

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
                    <>
                        {canDelete && (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setConfirmDelete(true)}
                            >
                                {labels.delete}
                            </Button>
                        )}
                        <span style={{ flex: 1 }} />
                        {canEdit && (
                            <Button
                                variant="primary"
                                onClick={() => setEditing(true)}
                            >
                                {labels.edit}
                            </Button>
                        )}
                    </>
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
                            style={{ resize: "vertical" }}
                        />
                    </ModalField>
                </>
            ) : (
                <>
                    <div className="mb-4 flex items-center gap-[9px]">
                        <Avatar
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
                                                ({labels.editedTag})
                                            </span>
                                        )}
                                    </span>
                                    <span
                                        className="block text-[13px]"
                                        style={{ color: T.TEXT_MUTED }}
                                    >
                                        {note.added_by?.name ??
                                            labels.unknownAuthor}
                                    </span>
                                </>
                            ) : (
                                <span className="block text-sm font-semibold">
                                    {note.added_by?.name ??
                                        labels.unknownAuthor}
                                    {note.updated_at !== note.created_at && (
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
                    <div
                        className="text-[14px] leading-[1.7] break-words whitespace-pre-wrap"
                        style={{ color: T.TEXT }}
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
