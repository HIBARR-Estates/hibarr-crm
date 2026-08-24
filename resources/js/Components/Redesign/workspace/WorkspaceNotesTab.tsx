import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Note } from "@/Types/api/note";
import { HtmlRenderer } from "@/Components/ContentRenderer";
import { toWorkspaceNotePreview } from "../adapters/noteAdapter";
import Avatar from "../primitives/Avatar";
import BulkActionBar from "../primitives/BulkActionBar";
import Button from "../primitives/Button";
import ConfirmDialog from "../primitives/ConfirmDialog";
import Icon from "../primitives/Icon";
import IntegrationOriginBadge from "../primitives/IntegrationOriginBadge";
import SelectCheckbox from "../primitives/SelectCheckbox";
import { REDESIGN_TOKENS as T } from "../tokens";

export interface WorkspaceNotesTabProps<T extends Note = Note> {
    notes: T[];
    setNotes: Dispatch<SetStateAction<T[]>>;
    canAdd: boolean;
    canBulkDelete: boolean;
    canDeleteNote: (note: T) => boolean;
    canEditNote?: (note: T) => boolean;
    onAddNote: () => void;
    bulkActionRoute: string;
    onDeleteNote: (onSuccess?: () => void) => void;
    isDeleting: boolean;
    confirmDeleteId: number | null;
    setConfirmDeleteId: (id: number | null) => void;
    renderDetailModal: (args: {
        note: T;
        onClose: () => void;
        initialEditing: boolean;
    }) => ReactNode;
}

/** Shared notes list for Deal + Lead redesign workspaces. */
export default function WorkspaceNotesTab<T extends Note = Note>({
    notes,
    setNotes,
    canAdd,
    canBulkDelete,
    canDeleteNote,
    canEditNote,
    onAddNote,
    bulkActionRoute,
    onDeleteNote,
    isDeleting,
    confirmDeleteId,
    setConfirmDeleteId,
    renderDetailModal,
}: WorkspaceNotesTabProps<T>) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [openInEdit, setOpenInEdit] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        { row_ids: string; action_type: string },
        null,
        ApiResponse<null>
    >(bulkActionRoute, "POST");
    const isBulkDeleting = isLoading({ status: bulkStatus });

    const noteItems = useMemo(
        () => notes.map((note) => toWorkspaceNotePreview(note)),
        [notes],
    );

    const toggleSelect = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    const openOrSelectNote = (id: number) => {
        if (selectMode) {
            toggleSelect(id);
            return;
        }
        setOpenInEdit(false);
        setSelectedNoteId(id);
    };
    const exitSelect = () => {
        setSelectMode(false);
        setSelected(new Set());
    };
    const allSelected =
        noteItems.length > 0 && selected.size === noteItems.length;
    const toggleAll = () =>
        setSelected(
            allSelected ? new Set() : new Set(noteItems.map((note) => note.id)),
        );

    const bulkDelete = () => {
        applyBulkAction(
            {
                row_ids: Array.from(selected).join(","),
                action_type: "delete",
            },
            {
                onSuccess: () => {
                    setNotes((prev) =>
                        prev.filter((note) => !selected.has(note.id)),
                    );
                    setConfirmBulkDelete(false);
                    exitSelect();
                },
            },
        );
    };

    return (
        <div>
            {(canAdd || (noteItems.length > 0 && canBulkDelete)) && (
                <div className="mb-2 flex justify-end gap-1.5">
                    {canAdd && (
                        <Button variant="primary" size="sm" onClick={onAddNote}>
                            {t("pages.deals.workspace.notes.add_note")}
                        </Button>
                    )}
                    {noteItems.length > 0 && canBulkDelete && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                selectMode ? exitSelect() : setSelectMode(true)
                            }
                        >
                            {selectMode
                                ? t("pages.deals.common.cancel")
                                : t("pages.deals.common.select")}
                        </Button>
                    )}
                </div>
            )}

            {selectMode && (
                <BulkActionBar
                    count={selected.size}
                    onClear={() => setSelected(new Set())}
                    clearLabel={t("pages.deals.common.clear")}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={toggleAll}
                    >
                        {allSelected
                            ? t("pages.deals.common.deselect_all")
                            : t("pages.deals.common.select_all")}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.RED, color: T.WHITE }}
                        disabled={!selected.size}
                        onClick={() => setConfirmBulkDelete(true)}
                    >
                        {t("pages.deals.common.delete")}
                    </button>
                </BulkActionBar>
            )}

            {noteItems.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {t("pages.deals.workspace.notes.empty")}
                </p>
            ) : (
                noteItems.map((note) => {
                    const rawNote = notes.find((item) => item.id === note.id);
                    const showDelete =
                        !selectMode &&
                        rawNote != null &&
                        canDeleteNote(rawNote);
                    const showEdit =
                        !selectMode &&
                        rawNote != null &&
                        (canEditNote?.(rawNote) ?? true);

                    return (
                        <div
                            key={note.id}
                            className="dr-card flex items-start gap-2.5"
                        >
                            {selectMode && (
                                <div className="pt-0.5">
                                    <SelectCheckbox
                                        checked={selected.has(note.id)}
                                        onChange={() => toggleSelect(note.id)}
                                        label={`${t("pages.deals.common.select_note")}: ${note.title || note.authorName}`}
                                    />
                                </div>
                            )}
                            <div
                                className="min-w-0 flex-1"
                                style={{ color: T.TEXT }}
                            >
                                <div className="mb-[7px] flex items-center justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openOrSelectNote(note.id)}
                                        aria-label={
                                            selectMode
                                                ? `${t("pages.deals.common.select_note")}: ${note.title || note.authorName}`
                                                : `${t("pages.deals.common.open_note")}: ${note.title || note.authorName}`
                                        }
                                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-[7px] border-none bg-transparent p-0 text-left"
                                    >
                                        <Avatar
                                            size={24}
                                            initials={note.authorInitials}
                                        />
                                        <span className="min-w-0">
                                            {note.title ? (
                                                <>
                                                    <span className="block truncate text-[13px] font-semibold">
                                                        {note.title}
                                                        {note.edited && (
                                                            <span
                                                                className="text-[12px] font-normal italic"
                                                                style={{
                                                                    color: T.TEXT_MUTED,
                                                                }}
                                                            >
                                                                {" "}
                                                                (
                                                                {t(
                                                                    "pages.deals.workspace.notes.edited_tag",
                                                                )}
                                                                )
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className="block text-[12px]"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {note.authorName}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="block truncate text-[13px] font-semibold">
                                                    {note.authorName}
                                                    {note.edited && (
                                                        <span
                                                            className="text-[12px] font-normal italic"
                                                            style={{
                                                                color: T.TEXT_MUTED,
                                                            }}
                                                        >
                                                            {" "}
                                                            (
                                                            {t(
                                                                "pages.deals.workspace.notes.edited_tag",
                                                            )}
                                                            )
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                    <div className="flex items-center gap-2">
                                        <IntegrationOriginBadge
                                            origin={note.integrationOrigin}
                                        />
                                        <span
                                            className="shrink-0 text-[12px]"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {note.timeLabel}
                                        </span>
                                        {showEdit && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setOpenInEdit(true);
                                                    setSelectedNoteId(note.id);
                                                }}
                                                aria-label={`${td("Edit", { source: "en" })}: ${note.title || note.authorName}`}
                                            >
                                                <Icon name="edit" size={13} />
                                            </Button>
                                        )}
                                        {showDelete && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setConfirmDeleteId(note.id);
                                                }}
                                                aria-label={`${t("pages.deals.common.delete")}: ${note.title || note.authorName}`}
                                            >
                                                <Icon name="trash" size={13} />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => openOrSelectNote(note.id)}
                                    onKeyDown={(event) => {
                                        if (event.key !== "Enter" && event.key !== " ") return;
                                        event.preventDefault();
                                        openOrSelectNote(note.id);
                                    }}
                                    aria-label={
                                        selectMode
                                            ? `${t("pages.deals.common.select_note")}: ${note.title || note.authorName}`
                                            : `${t("pages.deals.common.open_note")}: ${note.title || note.authorName}`
                                    }
                                    className="min-w-0 cursor-pointer rounded-md px-3 py-2.5"
                                    style={{ background: T.SURFACE_2 }}
                                >
                                    <div
                                        className="workspace-note-card-clamp min-w-0 text-[15px]"
                                        style={{
                                            color: T.TEXT,
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        {rawNote?.details?.trim() ? (
                                            <HtmlRenderer
                                                content={rawNote.details}
                                                className="workspace-note-html text-[15px]"
                                            />
                                        ) : (
                                            <span style={{ color: T.TEXT_MUTED }}>
                                                {note.body}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}

            {selectedNote
                ? renderDetailModal({
                      note: selectedNote,
                      initialEditing: openInEdit,
                      onClose: () => {
                          setSelectedNoteId(null);
                          setOpenInEdit(false);
                      },
                  })
                : null}

            <ConfirmDialog
                open={confirmDeleteId != null}
                title={t("pages.deals.workspace.notes.delete_confirm_title")}
                message={t(
                    "pages.deals.workspace.notes.delete_single_confirm_message",
                )}
                confirmLabel={t("pages.deals.workspace.notes.delete_note")}
                danger
                confirmLoading={isDeleting}
                onConfirm={() => {
                    if (confirmDeleteId == null) return;
                    onDeleteNote(() => {
                        if (selectedNoteId === confirmDeleteId) {
                            setSelectedNoteId(null);
                        }
                        setConfirmDeleteId(null);
                    });
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title={`${t("pages.deals.common.delete")} ${selected.size} ${
                    selected.size === 1
                        ? t("pages.deals.workspace.notes.item_singular")
                        : t("pages.deals.workspace.notes.item_plural")
                }?`}
                message={t("pages.deals.workspace.notes.delete_confirm_message")}
                confirmLabel={t("pages.deals.workspace.notes.delete_notes")}
                danger
                confirmLoading={isBulkDeleting}
                onConfirm={bulkDelete}
                onCancel={() => setConfirmBulkDelete(false)}
            />
        </div>
    );
}
