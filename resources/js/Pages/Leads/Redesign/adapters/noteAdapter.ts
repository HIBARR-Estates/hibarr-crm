import type { LeadNote } from "@/Types/api/lead-note";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { formatUserDate } from "@/lib/userDateTime";

dayjs.extend(relativeTime);

export interface LeadNotePreview {
    id: number;
    title: string;
    preview: string;
    body: string;
    authorName: string;
    authorInitials: string;
    createdAt: Date | null;
    createdAtLabel: string;
    timeLabel: string;
}

function formatDate(value: string | undefined): {
    date: Date | null;
    label: string;
} {
    if (!value) {
        // Newly created notes can omit created_at in the store payload.
        const now = new Date();
        return { date: now, label: formatUserDate(now) };
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const now = new Date();
        return { date: now, label: formatUserDate(now) };
    }
    return { date, label: formatUserDate(date) };
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

function initialsFromName(name?: string): string {
    if (!name) return "--";
    return name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

export function toLeadNotePreview(note: LeadNote): LeadNotePreview {
    const { date, label } = formatDate(note.created_at);
    const body = stripHtml(note.details?.trim() || "");
    const authorName =
        note.added_by_user?.name ??
        note.added_by?.name ??
        "Unknown";

    return {
        id: note.id,
        title: note.title?.trim() || "Untitled note",
        preview: body || "No note details yet.",
        body: body || "No note details yet.",
        authorName,
        authorInitials: initialsFromName(authorName),
        createdAt: date,
        createdAtLabel: label,
        timeLabel: date ? dayjs(date).fromNow() : label,
    };
}
