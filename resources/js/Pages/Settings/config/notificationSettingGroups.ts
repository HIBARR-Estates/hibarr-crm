/**
 * Maps each EmailNotificationSetting row to the model/entity it belongs to, so
 * the notification-settings manager can render one collapsible section per
 * model instead of one flat 38-row table.
 *
 * Group names deliberately match the vocabulary used by the user-facing
 * notification preferences (App\Support\NotificationBypassCatalog::GROUPS), so
 * the same notification family reads the same in both screens.
 *
 * Static, hook-free config — labels are English source strings and get wrapped
 * in `td()` at the render site.
 */

export type NotificationSettingGroup =
    | "Deals"
    | "Leads"
    | "Tasks"
    | "Projects"
    | "Meetings"
    | "Finance"
    | "Tickets"
    | "HR"
    | "Users"
    | "Communication"
    | "Other";

/** Display order of the sections; groups with no rows are skipped. */
export const NOTIFICATION_GROUP_ORDER: NotificationSettingGroup[] = [
    "Deals",
    "Leads",
    "Tasks",
    "Projects",
    "Meetings",
    "Finance",
    "Tickets",
    "HR",
    "Users",
    "Communication",
    "Other",
];

/** Seeded slugs (EmailNotificationSetting::NOTIFICATIONS) → owning model. */
const GROUP_BY_SLUG: Record<string, NotificationSettingGroup> = {
    "deal-activity-notification": "Deals",
    "deal-package-notification": "Deals",
    "deal-property-notification": "Deals",
    "follow-up-reminder": "Deals",

    "lead-notification": "Leads",

    "task-completed": "Tasks",
    "task-status-updated": "Tasks",
    "task-priority-updated": "Tasks",
    "task-deleted": "Tasks",
    "task-rejected": "Tasks",
    "task-overdue": "Tasks",
    "task-mention-notification": "Tasks",
    "user-assign-to-task": "Tasks",
    "sub-task-created": "Tasks",

    "employee-assign-to-project": "Projects",
    "project-mention-notification": "Projects",
    "discussion-reply": "Projects",

    "event-notification": "Meetings",

    "invoice-createupdate-notification": "Finance",
    "order-createupdate-notification": "Finance",
    "payment-notification": "Finance",
    "estimate-notification": "Finance",
    "new-product-purchase-request": "Finance",
    "new-expenseadded-by-admin": "Finance",
    "new-expenseadded-by-member": "Finance",
    "expense-status-changed": "Finance",

    "new-support-ticket-request": "Tickets",

    "new-leave-application": "HR",
    "holiday-notification": "HR",
    "birthday-notification": "HR",
    "appreciation-notification": "HR",
    "shift-assign-notification": "HR",
    "daily-schedule-notification": "HR",

    "user-join-via-invitation": "Users",
    "user-registrationadded-by-admin": "Users",

    "message-notification": "Communication",
    "new-notice-published": "Communication",

    "mlm-partner-network-notification": "Other",
};

/**
 * Fallback for rows added after this map was written (or rows whose slug
 * column is empty): first matching keyword wins, so order matters — e.g.
 * "user-assign-to-task" must hit `task` before `user`.
 */
const KEYWORD_RULES: { pattern: RegExp; group: NotificationSettingGroup }[] = [
    { pattern: /deal/, group: "Deals" },
    { pattern: /lead/, group: "Leads" },
    { pattern: /task/, group: "Tasks" },
    { pattern: /project|discussion/, group: "Projects" },
    { pattern: /event|meeting|availability/, group: "Meetings" },
    {
        pattern:
            /invoice|payment|estimate|order|expense|product|proposal|contract|credit/,
        group: "Finance",
    },
    { pattern: /ticket/, group: "Tickets" },
    {
        pattern:
            /leave|holiday|shift|attendance|appreciation|birthday|timesheet|schedule|promotion/,
        group: "HR",
    },
    { pattern: /user|employee|member/, group: "Users" },
    { pattern: /message|chat|notice|mention|reminder/, group: "Communication" },
];

/**
 * Resolves the model a setting belongs to. `slug` is the stable identifier;
 * the setting name is only used when the slug is missing or unknown.
 */
export function resolveNotificationGroup(
    slug: string | null | undefined,
    settingName: string,
): NotificationSettingGroup {
    const key = (slug ?? "").trim().toLowerCase();
    if (key !== "" && GROUP_BY_SLUG[key] !== undefined) {
        return GROUP_BY_SLUG[key];
    }

    const haystack = `${key} ${settingName.toLowerCase()}`;
    for (const rule of KEYWORD_RULES) {
        if (rule.pattern.test(haystack)) {
            return rule.group;
        }
    }

    return "Other";
}
