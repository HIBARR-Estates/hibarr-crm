import type { Note } from "@/Types/api/note";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatDate } from "./dateFormat";
import { initialsFromName } from "./initials";

dayjs.extend(relativeTime);

export interface WorkspaceNotePreview {
    id: number;
    title: string;
    preview: string;
    body: string;
    authorName: string;
    authorInitials: string;
    createdAt: Date | null;
    createdAtLabel: string;
    timeLabel: string;
    edited: boolean;
}

function parseNoteDate(value: string | undefined): {
    date: Date | null;
    label: string;
} {
    if (!value) return { date: null, label: "No date" };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: null, label: "No date" };
    return { date, label: formatDate(date, "No date") };
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function toWorkspaceNotePreview(note: Note): WorkspaceNotePreview {
    const { date, label } = parseNoteDate(note.created_at);
    const body = stripHtml(note.details?.trim() || "");
    const authorName = note.added_by?.name ?? "Unknown";
    return {
        id: note.id,
        // Left empty (not "Untitled note") when the note has no title —
        // consumers fall back to showing the author name instead of a
        // placeholder string in that slot.
        title: note.title?.trim() || "",
        preview: body || "No note details yet.",
        body: body || "No note details yet.",
        authorName,
        authorInitials: initialsFromName(authorName),
        createdAt: date,
        createdAtLabel: label,
        timeLabel: note.created_at ? dayjs(note.created_at).fromNow() : label,
        edited: Boolean(note.updated_at && note.updated_at !== note.created_at),
    };
}
