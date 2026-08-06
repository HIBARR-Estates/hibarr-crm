import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { toWorkspaceNotePreview } from "@/Pages/Deals/Redesign/adapters/noteAdapter";
import DealAvatar from "@/Pages/Deals/Redesign/components/primitives/DealAvatar";
import DealBulkActionBar from "@/Pages/Deals/Redesign/components/primitives/DealBulkActionBar";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import DealConfirmDialog from "@/Pages/Deals/Redesign/components/primitives/DealConfirmDialog";
import DealIcon from "@/Pages/Deals/Redesign/components/primitives/DealIcon";
import DealSelectCheckbox from "@/Pages/Deals/Redesign/components/primitives/DealSelectCheckbox";
import { DEAL_REDESIGN_TOKENS as T } from "@/Pages/Deals/Redesign/tokens";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadNoteCreate from "../../../hooks/useLeadNoteCreate";
import useLeadNoteMutations from "../../../hooks/useLeadNoteMutations";
import LeadNoteDetailModal from "../LeadNoteDetailModal";

interface NotesTabProps {
    permissions?: Record<string, string>;
}

function canAddNote(permissions?: Record<string, string>): boolean {
    if (!permissions) return true;
    const permission = permissions.add_lead_note;
    return (
        permission === "all" ||
        permission === "added" ||
        permission === "both"
    );
}

function canDeleteNote(
    note: { added_by?: { id?: number }; added_by_user?: { id?: number } },
    permissions: Record<string, string> | undefined,
    userId: number | undefined,
): boolean {
    if (!permissions) return true;
    const authorId = note.added_by?.id ?? note.added_by_user?.id;
    return (
        permissions.delete_lead_note === "all" ||
        (permissions.delete_lead_note === "added" && authorId === userId)
    );
}

export default function NotesTab({ permissions }: NotesTabProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const { lead, notes, setNotes } = useLeadWorkspace();
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [text, setText] = useState("");
    const [selectMode, setSelectMode] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const { createNote, isSaving, errors } = useLeadNoteCreate(lead.id);
    const { deleteNote, isDeleting } = useLeadNoteMutations(confirmDeleteId ?? 0);
    const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        { row_ids: string; action_type: string },
        null,
        ApiResponse<null>
    >(route("lead-notes.apply_quick_action"), "POST");
    const isBulkDeleting = isLoading({ status: bulkStatus });

    const noteItems = useMemo(
        () => notes.map((note) => toWorkspaceNotePreview(note)),
        [notes],
    );

    const showComposer = canAddNote(permissions);
    const canBulkDelete =
        !permissions || permissions.delete_lead_note === "all";

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
                                    {td(error, { source: "en" })}
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
                        placeholder={t("pages.deals.workspace.notes.title_placeholder")}
                        aria-label={t("pages.deals.workspace.notes.title_aria_label")}
                    />
                    <textarea
                        value={text}
                        disabled={isSaving}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={t("pages.deals.workspace.notes.body_placeholder")}
                        aria-label={t("pages.deals.workspace.notes.body_aria_label")}
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
                            {t("pages.deals.workspace.notes.save")}
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
                        {selectMode ? t("pages.deals.common.cancel") : t("pages.deals.common.select")}
                    </DealButton>
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
                        canDeleteNote(rawNote, permissions, userId);

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
                                        {!selectMode && (
                                            <DealButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setSelectedNoteId(note.id);
                                                }}
                                                aria-label={`${td("Edit", { source: "en" })}: ${note.title || note.authorName}`}
                                            >
                                                <DealIcon name="edit" size={13} />
                                            </DealButton>
                                        )}
                                        {showDelete && (
                                            <DealButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setConfirmDeleteId(note.id);
                                                }}
                                                aria-label={`${t("pages.deals.common.delete")}: ${note.title || note.authorName}`}
                                            >
                                                <DealIcon name="trash" size={13} />
                                            </DealButton>
                                        )}
                                    </div>
                                </div>
                                <div
                                    className="dr-clamp-3 min-w-0 rounded-md px-2.5 py-2 text-[13px]"
                                    style={{
                                        color: T.TEXT_MUTED,
                                        lineHeight: 1.6,
                                        background: T.SURFACE_2,
                                        overflowWrap: "anywhere",
                                        wordBreak: "break-word",
                                    }}
                                >
                                    {note.body}
                                </div>
                            </button>
                        </div>
                    );
                })
            )}

            <LeadNoteDetailModal
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
