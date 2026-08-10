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

export function isSafeHttpUrl(href: string | null | undefined): href is string {
    if (!href || typeof href !== "string") return false;
    try {
        const url = new URL(href.trim());
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function withInboxFallback(
    actions: NotificationAlertAction[],
): NotificationAlertAction[] {
    if (actions.length > 0) return actions.slice(0, 2);
    const inbox = notificationsIndexHref();
    if (inbox) {
        return [{ label: "View inbox", primary: true, href: inbox }];
    }
    return [];
}

/** Contextual quick actions (up to two) per notification type. */
export function actionsForNotification(
    notification: Notification,
): NotificationAlertAction[] {
    if (isMeetingNotification(notification)) {
        return withInboxFallback(meetingActionsForNotification(notification));
    }

    if (isTaskNotification(notification)) {
        return withInboxFallback(taskActionsForNotification(notification));
    }

    const { link, icon, type_slug: slug } = notification;
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
        case "lead":
            pushLink(
                slug === "lead_agent_assigned" ? "Open deal" : "Open lead",
            );
            break;
        case "deal":
            pushLink("Open deal");
            break;
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

function isMeetingNotification(notification: Notification): boolean {
    const data = notification.data ?? {};
    if (data.entity_type === "meeting") return true;
    if (notification.type_slug === "auto_follow_up_reminder") return true;
    if (notification.type_slug === "event_reminder") return true;
    if (notification.icon === "event") return true;
    return false;
}

function isMeetingStartingNow(notification: Notification): boolean {
    const data = notification.data ?? {};
    if (data.starts_now === true) return true;

    const remindAt = data.remind_at;
    if (typeof remindAt === "string" && remindAt !== "") {
        const diffMs = new Date(remindAt).getTime() - Date.now();
        // From 5 minutes before through 15 minutes after scheduled start.
        return diffMs <= 5 * 60 * 1000 && diffMs >= -15 * 60 * 1000;
    }

    return false;
}

function meetingJoinHref(notification: Notification): string | null {
    const data = notification.data ?? {};
    for (const key of ["meeting_link", "event_link"] as const) {
        const value = data[key];
        if (typeof value === "string" && isSafeHttpUrl(value)) {
            return value.trim();
        }
    }
    return null;
}

function entityContextAction(
    notification: Notification,
    tab: "meetings" | "tasks",
): NotificationAlertAction | null {
    const data = notification.data ?? {};
    const dealId = data.deal_id;
    const leadId = data.lead_id;

    if (dealId != null && dealId !== "") {
        try {
            return {
                label: "Open deal",
                primary: false,
                href: `${route("deals.show", dealId)}?tab=${tab}`,
            };
        } catch {
            // fall through
        }
    }

    if (leadId != null && leadId !== "") {
        try {
            return {
                label: "Open lead",
                primary: false,
                href: `${route("lead-contact.show", leadId)}?tab=${tab}`,
            };
        } catch {
            // fall through
        }
    }

    return null;
}

function meetingLinkLabel(
    notification: Notification,
    href: string,
): string {
    const entityType = notification.data?.entity_type;
    if (entityType === "deal") return "Open deal";
    if (entityType === "lead") return "Open lead";

    if (/\/deals\/\d+/.test(href) || href.includes("deals.show")) {
        return "Open deal";
    }
    if (
        /\/lead-contact(?:\/|\?|$)/.test(href) ||
        href.includes("lead-contact.show")
    ) {
        return "Open lead";
    }

    return "Open meeting";
}

function meetingContextAction(
    notification: Notification,
): NotificationAlertAction | null {
    const context = entityContextAction(notification, "meetings");
    if (context) return context;

    if (notification.link && isSafeHttpUrl(notification.link)) {
        const href = notification.link;
        return {
            label: meetingLinkLabel(notification, href),
            primary: false,
            href,
        };
    }

    return null;
}

function meetingActionsForNotification(
    notification: Notification,
): NotificationAlertAction[] {
    const actions: NotificationAlertAction[] = [];
    const joinHref = meetingJoinHref(notification);
    const context = meetingContextAction(notification);
    const startingNow = isMeetingStartingNow(notification);

    if (startingNow && joinHref) {
        actions.push({
            label: "Join meeting",
            primary: true,
            href: joinHref,
            openInNewTab: true,
        });
    }

    if (context) {
        actions.push({
            ...context,
            primary: actions.length === 0,
        });
    }

    if (!startingNow && joinHref) {
        actions.push({
            label: "Open meeting",
            primary: actions.length === 0,
            href: joinHref,
            openInNewTab: true,
        });
    }

    return actions;
}

function isTaskNotification(notification: Notification): boolean {
    const data = notification.data ?? {};
    if (data.entity_type === "task") return true;
    if (notification.icon === "task" || notification.icon === "task-completed") {
        return true;
    }
    return /^(new_task|task_|auto_task_reminder|sub_task_)/.test(
        notification.type_slug,
    );
}

function taskHref(notification: Notification): string | null {
    const data = notification.data ?? {};
    const taskId = data.task_id ?? data.id;

    if (taskId != null && taskId !== "") {
        try {
            return route("tasks.show", taskId);
        } catch {
            // fall through
        }
    }

    return notification.link && isSafeHttpUrl(notification.link)
        ? notification.link
        : null;
}

function taskContextAction(
    notification: Notification,
): NotificationAlertAction | null {
    return entityContextAction(notification, "tasks");
}

function taskActionsForNotification(
    notification: Notification,
): NotificationAlertAction[] {
    const actions: NotificationAlertAction[] = [];
    const taskLink = taskHref(notification);
    const context = taskContextAction(notification);
    const completed =
        notification.icon === "task-completed" ||
        notification.type_slug.includes("completed");

    if (taskLink) {
        actions.push({
            label: completed ? "View task" : "Open task",
            primary: true,
            href: taskLink,
        });
    }

    if (context) {
        actions.push({
            ...context,
            primary: actions.length === 0,
        });
    }

    return actions;
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
        timeAgo: notification.time_ago,
        actions: actionsForNotification(notification),
    };
}
