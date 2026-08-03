import type { LeadNotePreview } from "../../../adapters/noteAdapter";

interface NoteCardProps {
    note: LeadNotePreview;
    onClick?: () => void;
}

export default function NoteCard({ note, onClick }: NoteCardProps) {
    return (
        <button
            type="button"
            className="v2-note-card mb-2 w-full cursor-pointer text-left"
            onClick={onClick}
        >
            <div className="mb-1 flex items-start justify-between gap-2">
                <span className="text-[13px] font-semibold text-[#1a1f2e]">
                    {note.title}
                </span>
                <span className="shrink-0 text-[11px] text-[#9ca3af]">
                    {note.timeLabel}
                </span>
            </div>
            <p className="mb-1.5 line-clamp-2 text-xs leading-relaxed text-[#6b7280]">
                {note.preview}
            </p>
            <span className="text-[11px] text-[#9ca3af]">{note.authorName}</span>
        </button>
    );
}
