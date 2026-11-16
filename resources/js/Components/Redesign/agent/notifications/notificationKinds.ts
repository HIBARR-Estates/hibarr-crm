import type { NotificationIcon } from "@/Types/api/notification";

/** The icon tile of a notification: which glyph and which palette colour (a --dr-* variable). */
export interface NotificationKind {
    icon: string;
    tint: string;
}

const KINDS: Record<NotificationIcon, NotificationKind> = {
    task: { icon: "check-square", tint: "--dr-blue" },
    "task-completed": { icon: "check", tint: "--dr-green" },
    comment: { icon: "message", tint: "--dr-purple" },
    discussion: { icon: "message", tint: "--dr-purple" },
    chat: { icon: "message", tint: "--dr-teal" },
    notice: { icon: "file-text", tint: "--dr-orange" },
    ticket: { icon: "lifebuoy", tint: "--dr-red" },
    lead: { icon: "user", tint: "--dr-blue" },
    deal: { icon: "briefcase", tint: "--dr-green" },
    project: { icon: "layers", tint: "--dr-purple" },
    expense: { icon: "wallet", tint: "--dr-orange" },
    invoice: { icon: "file-text", tint: "--dr-green" },
    contract: { icon: "file-text", tint: "--dr-blue" },
    leave: { icon: "calendar", tint: "--dr-blue" },
    "leave-approved": { icon: "check", tint: "--dr-green" },
    "leave-rejected": { icon: "ban", tint: "--dr-red" },
    event: { icon: "calendar", tint: "--dr-purple" },
    appreciation: { icon: "award", tint: "--dr-pink" },
    birthday: { icon: "award", tint: "--dr-orange" },
    shift: { icon: "clock", tint: "--dr-orange" },
    promotion: { icon: "award", tint: "--dr-green" },
    reminder: { icon: "clock", tint: "--dr-blue" },
    mail: { icon: "mail", tint: "--dr-blue" },
    bell: { icon: "bell", tint: "--dr-gray-dark" },
};

export function notificationKind(icon: NotificationIcon | string): NotificationKind {
    return KINDS[icon as NotificationIcon] ?? KINDS.bell;
}

/**
 * How loud a notification is (canvas L7-36): "alert" for something late or
 * refused (red tint), "warn" for something that failed or needs a hand (amber),
 * "info" for the rest. Read from the notification's type, e.g. task_overdue.
 */
export type NotificationTone = "alert" | "warn" | "info";

export function notificationTone(typeSlug: string | null | undefined): NotificationTone {
    const slug = typeSlug ?? "";
    if (/overdue|rejected/.test(slug)) return "alert";
    if (/failed|escalation/.test(slug)) return "warn";
    return "info";
}
