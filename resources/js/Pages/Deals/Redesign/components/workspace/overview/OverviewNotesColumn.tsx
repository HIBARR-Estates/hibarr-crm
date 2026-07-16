import { App } from "antd";
import { useState } from "react";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import type { Deal } from "@/Types/api/deals";
import type { Note } from "@/Types/api/note";
import DealAvatar from "../../primitives/DealAvatar";
import DealButton from "../../primitives/DealButton";
import type { WorkspaceNotePreview } from "../../../adapters/noteAdapter";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";
import {
    OverviewColumnHeader,
    OverviewColumnShell,
    OverviewEmptyMini,
    OverviewViewLink,
} from "./overviewShared";

interface SaveNotePayload {
    title: string;
    details: string;
    lead_id: number;
}

interface OverviewNotesColumnProps {
    deal: Deal;
    notes: WorkspaceNotePreview[];
    onViewNote: () => void;
}

export default function OverviewNotesColumn({
    deal,
    notes,
    onViewNote,
}: OverviewNotesColumnProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { message } = App.useApp();
    const [composerOpen, setComposerOpen] = useState(false);
    const [noteText, setNoteText] = useState("");
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const addNoteMutation = useApiMutate<
        SaveNotePayload,
        Note,
        ApiResponse<Note>
    >(route("deal-notes.store"), "POST");

    const handleSave = () => {
        const trimmed = noteText.trim();
        if (!trimmed) return;

        addNoteMutation.mutate(
            {
                title: trimmed.slice(0, 80),
                details: `<p>${trimmed}</p>`,
                lead_id: deal.id,
            },
            {
                onSuccess: (response) => {
                    if (response?.status === "success") {
                        message.success(td("Note saved"));
                        setNoteText("");
                        setComposerOpen(false);
                        router.reload({ only: ["notes"] });
                    }
                },
                onError: (errorResponse) => {
                    const errors = errorFormatter(errorResponse)?.errors || [];
                    message.error(
                        Object.values(errors).flat().join(", ") ||
                            td("Failed to save note"),
                    );
                },
            },
        );
    };

    return (
        <OverviewColumnShell borderSide="left">
            <OverviewColumnHeader
                icon="file-text"
                iconBg={T.BLUE_LIGHT}
                iconColor={T.BLUE}
                title={t("pages.deals.tabs.notes")}
                count={notes.length}
                onAdd={() => setComposerOpen((open) => !open)}
                addActive={composerOpen}
            />
            <div className="max-h-[560px] overflow-y-auto pr-0.5">
                {composerOpen && (
                    <div
                        className="mb-2 rounded-lg border px-3 py-2.5"
                        style={{
                            background: T.BLUE_LIGHT,
                            borderColor: T.BLUE_MID,
                        }}
                    >
                        <textarea
                            value={noteText}
                            onChange={(event) => setNoteText(event.target.value)}
                            placeholder={td("Log a note...")}
                            className="h-14 w-full resize-none border-none bg-transparent text-xs leading-relaxed text-[#1a1f2e] outline-none"
                        />
                        <div
                            className="flex justify-end pt-1.5"
                            style={{ borderTop: `1px solid ${T.BLUE_MID}` }}
                        >
                            <DealButton
                                variant="navy"
                                onClick={handleSave}
                                disabled={!noteText.trim() || addNoteMutation.isPending}
                                loading={addNoteMutation.isPending}
                                style={{ fontSize: 11, padding: "4px 10px" }}
                            >
                                {td("Save")}
                            </DealButton>
                        </div>
                    </div>
                )}

                {notes.length === 0 ? (
                    <OverviewEmptyMini icon="file-text" label={td("No notes yet")} />
                ) : (
                    notes.map((note) => {
                        const expanded = expandedId === note.id;
                        return (
                            <article
                                key={note.id}
                                className="mb-2 cursor-pointer rounded-lg border border-[#e2e5ea] bg-white px-3 py-2.5"
                                onClick={() =>
                                    setExpandedId(expanded ? null : note.id)
                                }
                            >
                                <div className="mb-1.5 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <DealAvatar
                                            size={20}
                                            initials={note.authorInitials}
                                        />
                                        <span className="text-[11px] font-medium text-[#1a1f2e]">
                                            {note.authorName}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-[#9ca3af]">
                                        {note.timeLabel}
                                    </span>
                                </div>
                                <div
                                    className="text-xs leading-relaxed text-[#5b6472]"
                                    style={
                                        expanded
                                            ? undefined
                                            : {
                                                  display: "-webkit-box",
                                                  WebkitLineClamp: 2,
                                                  WebkitBoxOrient: "vertical",
                                                  overflow: "hidden",
                                              }
                                    }
                                >
                                    {note.body}
                                </div>
                                <div className="mt-2 border-t border-[#e2e5ea] pt-2 text-right">
                                    <OverviewViewLink
                                        label={td("View note ↗")}
                                        onClick={onViewNote}
                                    />
                                </div>
                            </article>
                        );
                    })
                )}
            </div>
        </OverviewColumnShell>
    );
}
