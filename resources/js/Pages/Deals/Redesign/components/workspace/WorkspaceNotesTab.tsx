import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Note } from "@/Types/api/note";
import { toWorkspaceNotePreview } from "../../adapters/noteAdapter";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteMutations from "../../hooks/useDealNoteMutations";
import DealAvatar from "../primitives/DealAvatar";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealNoteDetailModal from "./DealNoteDetailModal";

interface WorkspaceNotesTabProps {
    notes: Note[];
    permissions: Record<string, string>;
    onAddNote: () => void;
}

function canAddNote(
    permissions: Record<string, string>,
    isWatcherOnly: boolean,
): boolean {
    if (isWatcherOnly) return false;
    return (
        permissions.add_deal_note === "all" ||
        permissions.add_deal_note === "added" ||
        permissions.add_deal_note === "both"
    );
}

function canDeleteNote(
    note: Note,
    permissions: Record<string, string>,
    userId: number | undefined,
    isWatcherOnly: boolean,
): boolean {
    if (isWatcherOnly) return false;
    const scope = permissions.delete_deal_note;
    const isOwner = note.added_by?.id === userId;
    return (
        scope === "all" ||
        scope === "both" ||
        ((scope === "added" || scope === "owned") && isOwner)
    );
}

/** v2.2 NotesTab (deal-v2-2.jsx:1581-1692): add-note modal trigger + select
 * mode + bulk delete + title-first note cards. */
export default function WorkspaceNotesTab({
    notes,
    permissions,
    onAddNote,
}: WorkspaceNotesTabProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { deal, setNotes } = useDealWorkspace();
    const { isWatcherOnly } = useDealPermissions(deal);
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { deleteNote, isDeleting } = useDealNoteMutations(confirmDeleteId ?? 0);
    const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        { row_ids: string; action_type: string },
        null,
        ApiResponse<null>
    >(route("deal-notes.apply_quick_action"), "POST");
    const isBulkDeleting = isLoading({ status: bulkStatus });

    const noteItems = useMemo(
        () => notes.map((note) => toWorkspaceNotePreview(note)),
        [notes],
    );

    const canAdd = canAddNote(permissions, isWatcherOnly);
    // Bulk delete acts across authors, so only expose it with the full scope.
    const canBulkDelete =
        !isWatcherOnly && permissions.delete_deal_note === "all";

    const toggleSelect = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
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
                        <DealButton variant="primary" size="sm" onClick={onAddNote}>
                            {t("pages.deals.workspace.notes.add_note")}
                        </DealButton>
                    )}
                    {noteItems.length > 0 && canBulkDelete && (
                        <DealButton
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                                selectMode ? exitSelect() : setSelectMode(true)
                            }
                        >
                            {selectMode ? t("pages.deals.common.cancel") : t("pages.deals.common.select")}
                        </DealButton>
                    )}
                </div>
            )}

            {selectMode && (
                <DealBulkActionBar
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
                </DealBulkActionBar>
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
                        canDeleteNote(
                            rawNote,
                            permissions,
                            userId,
                            isWatcherOnly,
                        );

                    return (
                        <div
                            key={note.id}
                            className="dr-card flex items-start gap-2.5"
                        >
                            {selectMode && (
                                <div className="pt-0.5">
                                    <DealSelectCheckbox
                                        checked={selected.has(note.id)}
                                        onChange={() => toggleSelect(note.id)}
                                        label={`${t("pages.deals.common.select_note")}: ${note.title || note.authorName}`}
                                    />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    selectMode
                                        ? toggleSelect(note.id)
                                        : setSelectedNoteId(note.id)
                                }
                                aria-label={
                                    selectMode
                                        ? `${t("pages.deals.common.select_note")}: ${note.title || note.authorName}`
                                        : `${t("pages.deals.common.open_note")}: ${note.title || note.authorName}`
                                }
                                className="min-w-0 flex-1 cursor-pointer border-none bg-transparent p-0 text-left"
                                style={{ color: T.TEXT }}
                            >
                                <div className="mb-[7px] flex items-center justify-between gap-2">
                                    <span className="flex min-w-0 items-center gap-[7px]">
                                        <DealAvatar
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
                                                                ({t("pages.deals.workspace.notes.edited_tag")})
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className="block text-[12px]"
                                                        style={{ color: T.TEXT_MUTED }}
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
                                                            ({t("pages.deals.workspace.notes.edited_tag")})
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="shrink-0 text-[12px]"
                                            style={{ color: T.TEXT_MUTED }}
                                        >
                                            {note.timeLabel}
                                        </span>
                                        {showDelete && (
                                            <DealButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setConfirmDeleteId(note.id)}
                                                aria-label={`${t("pages.deals.common.delete")}: ${note.title || note.authorName}`}
                                            >
                                                <DealIcon name="trash" size={13} />
                                            </DealButton>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="dr-clamp-3 rounded-md px-2.5 py-2 text-[13px]"
                                    style={{
                                        color: T.TEXT_MUTED,
                                        lineHeight: 1.6,
                                        background: T.SURFACE_2,
                                    }}
                                >
                                    {note.body}
                                </div>
                            </button>
                        </div>
                    );
                })
            )}

            <DealNoteDetailModal
                note={selectedNote}
                permissions={permissions}
                onClose={() => setSelectedNoteId(null)}
            />

            <DealConfirmDialog
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
                    deleteNote(() => {
                        if (selectedNoteId === confirmDeleteId) {
                            setSelectedNoteId(null);
                        }
                        setConfirmDeleteId(null);
                    });
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            <DealConfirmDialog
                open={confirmBulkDelete}
                title={`${t("pages.deals.common.delete")} ${selected.size} ${selected.size === 1
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
