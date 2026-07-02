import type { Note } from "@/Types/api/note";

export interface WorkspaceNotePreview {
    id: number;
    title: string;
    preview: string;
    createdAt: Date | null;
    createdAtLabel: string;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
});

function formatDate(value: string | undefined): { date: Date | null; label: string } {
    if (!value) return { date: null, label: "No date" };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: null, label: "No date" };
    return { date, label: DATE_FORMAT.format(date) };
}

export function toWorkspaceNotePreview(note: Note): WorkspaceNotePreview {
    const { date, label } = formatDate(note.created_at);
    return {
        id: note.id,
        title: note.title?.trim() || "Untitled note",
        preview: note.details?.trim() || "No note details yet.",
        createdAt: date,
        createdAtLabel: label,
    };
}
