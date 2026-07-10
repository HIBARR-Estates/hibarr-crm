import { useEffect, useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Lead } from "@/Types/api/leads";
import type { LeadNote } from "@/Types/api/lead-note";
import { toLeadNotePreview } from "../../adapters/noteAdapter";
import useLeadNoteCreate from "../../hooks/useLeadNoteCreate";
import DealAvatar from "@/Pages/Deals/Redesign/components/primitives/DealAvatar";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import { LEAD_REDESIGN_TOKENS as T } from "../../types";

interface LeadNotesTabProps {
    lead: Lead;
    notes: LeadNote[];
    permissions: Record<string, string>;
}

function canAddNote(permissions: Record<string, string>): boolean {
    return (
        permissions.add_lead_note === "all" ||
        permissions.add_lead_note === "added" ||
        permissions.add_lead_note === "both"
    );
}

export default function LeadNotesTab({
    lead,
    notes,
    permissions,
}: LeadNotesTabProps) {
    const { td } = useTd();
    const [noteText, setNoteText] = useState("");
    const { createNote, isSaving, errors, clearErrors } = useLeadNoteCreate(
        lead.id,
    );

    const noteItems = useMemo(
        () => notes.map((note) => toLeadNotePreview(note)),
        [notes],
    );

    const showComposer = canAddNote(permissions);

    useEffect(() => {
        if (!showComposer) {
            setNoteText("");
            clearErrors();
        }
    }, [clearErrors, showComposer]);

    const handleSave = () => {
        createNote({ text: noteText }, () => {
            setNoteText("");
        });
    };

    return (
        <div>
            {showComposer && (
                <section className="mb-3.5 overflow-hidden rounded-lg border border-[#e2e5ea] bg-white px-[13px] py-[11px]">
                    {errors.length > 0 && (
                        <div className="mb-2 space-y-1">
                            {errors.map((error, index) => (
                                <p key={index} className="text-xs text-red-600">
                                    {error}
                                </p>
                            ))}
                        </div>
                    )}

                    <div
                        className="mb-2.5 rounded-md border px-3 py-2.5"
                        style={{
                            background: T.BLUE_LIGHT,
                            borderColor: T.BLUE_MID,
                        }}
                    >
                        <textarea
                            value={noteText}
                            onChange={(event) => setNoteText(event.target.value)}
                            placeholder={td("Log a note about this lead...")}
                            className="h-[68px] w-full resize-none border-none bg-transparent text-[13px] leading-relaxed text-[#1a1f2e] outline-none"
                        />
                    </div>

                    <div className="flex justify-end border-t border-[#e2e5ea] pt-2">
                        <DealButton
                            variant="navy"
                            onClick={handleSave}
                            disabled={!noteText.trim() || isSaving}
                            loading={isSaving}
                            style={{ fontSize: 12, padding: "6px 11px" }}
                        >
                            {td("Save note")}
                        </DealButton>
                    </div>
                </section>
            )}

            {noteItems.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No notes yet")}
                </p>
            ) : (
                noteItems.map((note) => (
                    <article
                        key={note.id}
                        className="mb-2 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0"
                    >
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-1.5">
                                <DealAvatar
                                    size={24}
                                    initials={note.authorInitials}
                                />
                                <span className="truncate text-xs font-medium text-[#1a1f2e]">
                                    {note.authorName}
                                </span>
                            </div>
                            <span className="shrink-0 text-[11px] text-[#9ca3af]">
                                {note.timeLabel}
                            </span>
                        </div>
                        <div className="text-[13px] leading-[1.65] text-[#6b7280]">
                            {note.body}
                        </div>
                    </article>
                ))
            )}
        </div>
    );
}
