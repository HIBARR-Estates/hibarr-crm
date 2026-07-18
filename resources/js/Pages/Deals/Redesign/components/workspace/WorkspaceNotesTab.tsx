import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import type { Note } from "@/Types/api/note";
import { toWorkspaceNotePreview } from "../../adapters/noteAdapter";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import DealAvatar from "../primitives/DealAvatar";
import DealBulkActionBar from "../primitives/DealBulkActionBar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealSelectCheckbox from "../primitives/DealSelectCheckbox";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealNoteDetailModal from "./DealNoteDetailModal";

interface WorkspaceNotesTabProps {
    notes: Note[];
    permissions: Record<string, string>;
}

function canAddNote(permissions: Record<string, string>): boolean {
    return (
        permissions.add_deal_note === "all" ||
        permissions.add_deal_note === "added" ||
        permissions.add_deal_note === "both"
    );
}

/** v2.2 NotesTab (deal-v2-2.jsx:1581-1692): inline composer + select mode +
 * bulk delete + title-first note cards. */
export default function WorkspaceNotesTab({
    notes,
    permissions,
}: WorkspaceNotesTabProps) {
    const { td } = useTd();
    const { deal, setNotes } = useDealWorkspace();
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const { createNote, isSaving, errors } = useDealNoteCreate(deal.id);
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

    const showComposer = canAddNote(permissions);
    // Bulk delete acts across authors, so only expose it with the full scope.
    const canBulkDelete = permissions.delete_deal_note === "all";

    const saveNote = () => {
        createNote({ title, text }, () => {
            setTitle("");
            setText("");
        });
    };

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
            {showComposer && (
                <div
                    className="mb-3 rounded-[10px] border p-3"
                    style={{ background: T.SURFACE_2, borderColor: T.BORDER }}
                >
                    {errors.length > 0 && (
                        <div className="mb-2 space-y-1">
                            {errors.map((error, index) => (
                                <p key={index} className="text-xs text-red-600">
                                    {error}
                                </p>
                            ))}
                        </div>
                    )}
                    <input
                        className="dr-input mb-2"
                        style={{ fontSize: 13 }}
                        value={title}
                        disabled={isSaving}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={td("Note title (optional)")}
                        aria-label={td("Note title")}
                    />
                    <textarea
                        value={text}
                        disabled={isSaving}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={td("Log a note about this interaction...")}
                        aria-label={td("New note")}
                        className="w-full border-none bg-transparent outline-none"
                        style={{
                            fontSize: 13,
                            color: T.TEXT,
                            resize: "none",
                            height: 64,
                            fontFamily: "inherit",
                            lineHeight: 1.55,
                        }}
                    />
                    <div
                        className="flex justify-end gap-1.5 pt-2"
                        style={{ borderTop: `1px solid ${T.BORDER}` }}
                    >
                        <DealButton
                            variant="primary"
                            size="sm"
                            disabled={!text.trim() || isSaving}
                            loading={isSaving}
                            onClick={saveNote}
                        >
                            {td("Save note")}
                        </DealButton>
                    </div>
                </div>
            )}

            {noteItems.length > 0 && canBulkDelete && (
                <div className="mb-2 flex justify-end">
                    <DealButton
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            selectMode ? exitSelect() : setSelectMode(true)
                        }
                    >
                        {selectMode ? td("Cancel") : td("Select")}
                    </DealButton>
                </div>
            )}

            {selectMode && (
                <DealBulkActionBar
                    count={selected.size}
                    onClear={() => setSelected(new Set())}
                    clearLabel={td("Clear")}
                >
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.WHITE, color: T.NAVY }}
                        onClick={toggleAll}
                    >
                        {allSelected ? td("Deselect all") : td("Select all")}
                    </button>
                    <button
                        type="button"
                        className="dr-btn dr-btn-sm"
                        style={{ background: T.RED, color: T.WHITE }}
                        disabled={!selected.size}
                        onClick={() => setConfirmBulkDelete(true)}
                    >
                        {td("Delete")}
                    </button>
                </DealBulkActionBar>
            )}

            {noteItems.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No notes yet")}
                </p>
            ) : (
                noteItems.map((note) => (
                    <div
                        key={note.id}
                        className="dr-card flex items-start gap-2.5"
                    >
                        {selectMode && (
                            <div className="pt-0.5">
                                <DealSelectCheckbox
                                    checked={selected.has(note.id)}
                                    onChange={() => toggleSelect(note.id)}
                                    label={`Select note ${note.title || note.authorName}`}
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
                                    ? `Select note ${note.title || note.authorName}`
                                    : `Open note — ${note.title || note.authorName}`
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
                                                            className="text-[11px] font-normal italic"
                                                            style={{
                                                                color: T.TEXT_MUTED,
                                                            }}
                                                        >
                                                            {" "}
                                                            ({td("edited")})
                                                        </span>
                                                    )}
                                                </span>
                                                <span
                                                    className="block text-[11px]"
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
                                                        className="text-[11px] font-normal italic"
                                                        style={{
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {" "}
                                                        ({td("edited")})
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                <span
                                    className="shrink-0 text-[11px]"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {note.timeLabel}
                                </span>
                            </div>
                            <div
                                className="dr-clamp-2 text-[13px]"
                                style={{ color: T.TEXT_MUTED, lineHeight: 1.6 }}
                            >
                                {note.body}
                            </div>
                        </button>
                    </div>
                ))
            )}

            <DealNoteDetailModal
                note={selectedNote}
                permissions={permissions}
                onClose={() => setSelectedNoteId(null)}
            />

            <DealConfirmDialog
                open={confirmBulkDelete}
                title={`${td("Delete")} ${selected.size} ${
                    selected.size === 1 ? td("note") : td("notes")
                }?`}
                message={td(
                    "These notes will be permanently removed from the deal. This cannot be undone.",
                )}
                confirmLabel={td("Delete notes")}
                danger
                confirmLoading={isBulkDeleting}
                onConfirm={bulkDelete}
                onCancel={() => setConfirmBulkDelete(false)}
            />
        </div>
    );
}
