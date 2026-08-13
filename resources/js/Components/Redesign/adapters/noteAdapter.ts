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
    if (!value) {
        // Newly created notes without a serialized created_at still exist "now".
        const now = new Date();
        return { date: now, label: formatDate(now, "Just now") };
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        const now = new Date();
        return { date: now, label: formatDate(now, "Just now") };
    }
    return { date, label: formatDate(date, "Just now") };
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

/** dayjs().fromNow() alone drifts between "a day ago" and "2 days ago" with
 * no clear rule a reader can predict. Special-casing yesterday and falling
 * back to the shared absolute date past a week keeps the transitions
 * deliberate instead of whatever dayjs's raw thresholds happen to produce. */
function relativeNoteLabel(date: Date, absoluteFallback: string): string {
    const diffDays = dayjs().startOf("day").diff(dayjs(date).startOf("day"), "day");
    if (diffDays === 1) return "Yesterday";
    if (diffDays >= 2 && diffDays < 7) return dayjs(date).fromNow();
    if (diffDays >= 7) return absoluteFallback;
    return dayjs(date).fromNow();
}

export function toWorkspaceNotePreview(note: Note): WorkspaceNotePreview {
    const { date, label } = parseNoteDate(note.created_at);
    const body = stripHtml(note.details?.trim() || "");
    const authorName =
        note.added_by?.name ??
        (note as Note & { added_by_user?: { name?: string } }).added_by_user
            ?.name ??
        "Unknown";
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
        timeLabel: date ? relativeNoteLabel(date, label) : label,
        edited: Boolean(note.updated_at && note.updated_at !== note.created_at),
    };
}

/** Permission scopes are "all" | "added" | "owned" | "both" | "none".
 * "added"/"owned" both mean "only your own notes"; "both" behaves as "all". */
export function hasNoteScopeAccess(
    scope: string | undefined,
    isOwner: boolean,
): boolean {
    return (
        scope === "all" ||
        scope === "both" ||
        ((scope === "added" || scope === "owned") && isOwner)
    );
}
