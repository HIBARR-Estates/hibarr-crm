import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Note } from "@/Types/api/note";
import { toWorkspaceNotePreview } from "../../adapters/noteAdapter";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealNoteDetailModal from "./DealNoteDetailModal";

interface WorkspaceNotesTabProps {
    notes: Note[];
    permissions: Record<string, string>;
    onAddNote: () => void;
}

function canAddNote(permissions: Record<string, string>): boolean {
    return (
        permissions.add_deal_note === "all" ||
        permissions.add_deal_note === "added" ||
        permissions.add_deal_note === "both"
    );
}

export default function WorkspaceNotesTab({
    notes,
    permissions,
    onAddNote,
}: WorkspaceNotesTabProps) {
    const { td } = useTd();
    const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
    const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;

    const noteItems = useMemo(
        () => notes.map((note) => toWorkspaceNotePreview(note)),
        [notes],
    );

    const showAddNote = canAddNote(permissions);

    return (
        <div>
            {showAddNote && (
                <div className="mb-3.5 flex justify-end">
                    <DealButton variant="navy" onClick={onAddNote}>
                        + {td("Add note")}
                    </DealButton>
                </div>
            )}

            {noteItems.length === 0 ? (
                <p className="px-1 text-[13px] italic text-[#9ca3af]">
                    {td("No notes yet")}
                </p>
            ) : (
                noteItems.map((note) => (
                    <article
                        key={note.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedNoteId(note.id)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") setSelectedNoteId(note.id);
                        }}
                        className="mb-2 cursor-pointer rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0 hover:border-[#b8d4f0]"
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
                        <div className="dr-clamp-2 text-[13px] leading-[1.65] text-[#5b6472]">
                            {note.body}
                        </div>
                    </article>
                ))
            )}

            <DealNoteDetailModal
                note={selectedNote}
                permissions={permissions}
                onClose={() => setSelectedNoteId(null)}
            />
        </div>
    );
}
