import type {
    Notification,
    NotificationIcon,
} from "@/Types/api/notification";
import type {
    NotificationAlertPayload,
    NotchSeverity,
    NotificationAlertAction,
} from "@/Components/NotificationAlertProvider";

const SEVERITY_BY_ICON: Record<NotificationIcon, NotchSeverity> = {
    task: "amber",
    "task-completed": "green",
    comment: "navy",
    notice: "blue",
    chat: "teal",
    ticket: "red",
    lead: "blue",
    deal: "green",
    project: "navy",
    expense: "amber",
    invoice: "green",
    leave: "blue",
    "leave-approved": "green",
    "leave-rejected": "red",
    event: "teal",
    appreciation: "teal",
    birthday: "teal",
    contract: "blue",
    discussion: "navy",
    shift: "amber",
    promotion: "green",
    reminder: "blue",
    bell: "gray",
};

const NAME_KEYS = [
    "name",
    "agent_name",
    "assignee_name",
    "lead_name",
    "contact_name",
    "person_name",
    "client_name",
    "assigned_by_name",
    "triggered_by_name",
    "triggered_by",
    "from_name",
];

/**
 * Two-letter initials (first + last) for the icon tile — never a lone
 * letter. A single-word name (e.g. a first-name-only sender) falls through
 * to the next candidate key, and if none has a real full name the tile
 * shows the plain accent dot from the design instead of a stray initial.
 */
function initialsFromData(data: Record<string, unknown>): string | undefined {
    for (const key of NAME_KEYS) {
        const value = data?.[key];
        if (typeof value !== "string" || !value.trim()) continue;
        const parts = value.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const initials = (parts[0][0] ?? "") + (parts[1][0] ?? "");
        if (initials.length === 2) return initials.toUpperCase();
    }
    return undefined;
}

function compactMeta(text: string, max = 72): string {
    const oneLine = text.replace(/\s+/g, " ").trim();
    if (oneLine.length <= max) return oneLine;
    return oneLine.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Keys, in priority order, that name the *subject* of a notification
 * (the deal/task/ticket/etc. it's about) — distinct from `text`, which is
 * the narrative sentence. Used for the compact line so hovering to reveal
 * `text` in the body isn't just re-showing the same string.
 */
const SUBJECT_KEYS = [
    "deal_name",
    "event_name",
    "item_name",
    "heading",
    "subject",
    "title",
    "name",
];

function resolveSubject(notification: Notification): string | undefined {
    const data = notification.data ?? {};
    for (const key of SUBJECT_KEYS) {
        const value = data[key];
        if (
            typeof value === "string" &&
            value.trim() &&
            value.trim() !== notification.title.trim()
        ) {
            return value.trim();
        }
    }
    if (notification.icon === "chat" && typeof data.from_name === "string") {
        return `From ${data.from_name}`;
    }
    return undefined;
}

/** Human label + entity id for the "where this leads" breadcrumb. */
const DEST_LABEL_BY_ICON: Record<NotificationIcon, string> = {
    task: "Tasks",
    "task-completed": "Tasks",
    comment: "Notes",
    notice: "Notices",
    chat: "Messages",
    ticket: "Tickets",
    lead: "Leads",
    deal: "Deals",
    project: "Projects",
    expense: "Expenses",
    invoice: "Invoices",
    leave: "Leaves",
    "leave-approved": "Leaves",
    "leave-rejected": "Leaves",
    event: "Meetings",
    appreciation: "Appreciations",
    birthday: "Team",
    contract: "Contracts",
    discussion: "Discussions",
    shift: "Attendance",
    promotion: "Team",
    reminder: "Reminder ledger",
    bell: "Notifications",
};

const DEST_ID_KEYS = [
    "deal_id",
    "task_id",
    "project_id",
    "ticket_number",
    "invoice_number",
    "reminder_id",
    "follow_up_id",
    "id",
];

/**
 * Deal/lead assignment (`lead_agent_assigned`) has an actual name and lead
 * source available — showing those beats a bare numeric id.
 */
function resolveLeadAssignmentDest(notification: Notification): string | undefined {
    if (notification.type_slug !== "lead_agent_assigned") return undefined;
    const data = notification.data ?? {};
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!name) return undefined;
    const source = typeof data.source === "string" ? data.source.trim() : "";
    return source ? `${name} · ${source}` : name;
}

function resolveDest(notification: Notification): string | undefined {
    const leadAssignmentDest = resolveLeadAssignmentDest(notification);
    if (leadAssignmentDest) return leadAssignmentDest;

    const label = DEST_LABEL_BY_ICON[notification.icon];
    if (!label) return undefined;

    const data = notification.data ?? {};
    for (const key of DEST_ID_KEYS) {
        const value = data[key];
        if (typeof value === "string" || typeof value === "number") {
            return `${label} · #${value}`;
        }
    }
    return label;
}

function reminderLedgerHref(): string | null {
    try {
        return route("reminder-ledger.index");
    } catch {
        return null;
    }
}

function notificationsIndexHref(): string | null {
    try {
        return route("notifications.index");
    } catch {
        return null;
    }
}

/** Contextual quick actions (up to two) per notification type. */
export function actionsForNotification(
    notification: Notification,
): NotificationAlertAction[] {
    const { link, icon, type_slug: slug, text } = notification;
    const actions: NotificationAlertAction[] = [];

    const pushLink = (label: string, primary = true) => {
        if (link) actions.push({ label, primary, href: link });
    };

    switch (icon) {
        case "reminder":
            pushLink("Open reminder");
            {
                const ledger = reminderLedgerHref();
                if (ledger) actions.push({ label: "Open ledger", href: ledger });
            }
            break;
        case "task":
            pushLink(
                slug.includes("completed") ? "View task" : "Open task",
            );
            break;
        case "task-completed":
            pushLink("View task");
            break;
        case "lead":
            pushLink(
                slug === "lead_agent_assigned" ? "Open deal" : "Open lead",
            );
            break;
        case "deal":
            pushLink("Open deal");
            break;
        case "event": {
            const startsNow =
                /starts now|starting now|due now/i.test(text) ||
                /starts now|starting now/i.test(notification.title);
            pushLink(startsNow ? "Join meeting" : "Open meeting");
            break;
        }
        case "comment":
        case "discussion":
            pushLink(slug.includes("mention") ? "Open note" : "Open");
            break;
        case "chat":
            pushLink(slug.includes("mention") ? "Reply" : "Open chat");
            break;
        case "ticket":
            pushLink("Open ticket");
            break;
        case "leave":
        case "leave-approved":
        case "leave-rejected":
            pushLink("Open leave");
            break;
        case "invoice":
            pushLink("Open invoice");
            break;
        case "project":
            pushLink("Open project");
            break;
        case "contract":
            pushLink("Open contract");
            break;
        case "expense":
            pushLink("Open expense");
            break;
        case "notice":
            pushLink("Read notice");
            break;
        default:
            pushLink("Open");
    }

    if (actions.length === 0) {
        const inbox = notificationsIndexHref();
        if (inbox) actions.push({ label: "View inbox", primary: true, href: inbox });
    }

    const seen = new Set<string>();
    return actions
        .filter((a) => {
            const key = `${a.label}:${a.href ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, 2);
}

export function mapNotificationToAlert(
    notification: Notification,
): NotificationAlertPayload {
    const subject = resolveSubject(notification);
    const meta = subject
        ? compactMeta(subject, 72)
        : compactMeta(notification.text, 72);

    // Body always carries the full narrative sentence — never the same
    // string the compact `meta` line already shows.
    const fullText = notification.text.trim();
    const body =
        fullText && fullText !== meta.replace(/…$/, "").trim()
            ? fullText
            : undefined;

    return {
        id: notification.id,
        title: notification.title,
        meta,
        body,
        dest: resolveDest(notification),
        link: notification.link,
        severity: SEVERITY_BY_ICON[notification.icon] ?? "gray",
        initials: initialsFromData(notification.data ?? {}),
        timeAgo: notification.time_ago,
        actions: actionsForNotification(notification),
    };
}
