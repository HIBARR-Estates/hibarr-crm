/**
 * Design tokens for the Tasks workspace redesign.
 *
 * The ICON / PRIORITY / STATUS / CATEGORIES / BUCKETS maps mirror the
 * `Tasks Workspace Redesign.dc.html` handoff. Every colour resolves to the
 * shared palette (`REDESIGN_TOKENS`, design-tokens.json) — the handoff's
 * hexes were already that palette; the priority orange/yellow scale was
 * added to it. Don't reintroduce raw hexes here.
 */
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

/** Raw SVG path data, keyed as in the template's ICON map. */
export const TASK_ICON = {
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87",
    euro: "M18 6.2A7 7 0 0 0 8 8m0 8a7 7 0 0 0 10 1.8M4 10h9M4 14h9",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
    calendar:
        "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    building:
        "M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h4a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2",
    pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
    note: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4",
    // Bare exclamation mark — deliberately without the template's enclosing
    // circle, so urgent reads as a plain "!" stripe next to the checkbox.
    prioUrgent: "M12 4v10M12 19.5h.01",
    prioHighest: "M4 17l8-7 8 7M4 11l8-7 8 7",
    prioHigh: "M5 16l7-7 7 7",
    // Two parallel bars with a gap — an "equals" between the up/down arrows.
    prioMedium: "M5 9h14M5 15h14",
    prioLow: "M5 8l7 7 7-7",
    prioLowest: "M4 7l8 7 8-7M4 13l8 7 8-7",
    inboxEmpty:
        "M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-4h14l2 4M9 12h6",
    filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    board: "M4 4h6v16H4zM14 4h6v9h-6z",
    refresh:
        "M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5",
    plus: "M12 5v14M5 12h14",
    chevron: "m6 9 6 6 6-6",
    x: "M18 6 6 18M6 6l12 12",
    more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    externalLink: "M7 17 17 7M7 7h10v10",
    edit: "M18 2l4 4-11 11H7v-4zM3 21h18",
    check: "M20 6 9 17l-5-5",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    enter: "M9 10 4 15l5 5M20 4v7a4 4 0 0 1-4 4H4",
} as const;

export type TaskPriorityKey =
    "urgent" | "highest" | "high" | "medium" | "low" | "lowest";

export interface PriorityToken {
    label: string;
    d: string;
    /** Icon / stripe colour. */
    color: string;
    bg: string;
    fg: string;
    border: string;
}

export const TASK_PRIORITY: Record<TaskPriorityKey, PriorityToken> = {
    urgent: {
        label: "Urgent",
        d: TASK_ICON.prioUrgent,
        color: T.RED,
        bg: T.RED_SOFT,
        fg: T.RED,
        border: T.RED_MID,
    },
    highest: {
        label: "Highest",
        d: TASK_ICON.prioHighest,
        color: T.ORANGE,
        bg: T.AMBER_SOFT,
        fg: T.ORANGE_TEXT,
        border: T.AMBER_MID,
    },
    high: {
        label: "High",
        d: TASK_ICON.prioHigh,
        color: T.YELLOW,
        bg: T.YELLOW_SOFT,
        fg: T.YELLOW_TEXT,
        border: T.AMBER_BORDER,
    },
    medium: {
        label: "Medium",
        d: TASK_ICON.prioMedium,
        color: T.BLUE,
        bg: T.BLUE_LIGHT,
        fg: T.BLUE_DARK,
        border: T.BLUE_MID,
    },
    low: {
        label: "Low",
        d: TASK_ICON.prioLow,
        color: T.TEAL,
        bg: T.TEAL_SOFT,
        fg: T.TEAL,
        border: T.TEAL_MID,
    },
    lowest: {
        label: "Lowest",
        d: TASK_ICON.prioLowest,
        color: T.TEXT_HINT,
        bg: T.GRAY,
        fg: T.TEXT_MUTED,
        border: T.GRAY_MID,
    },
};

export const TASK_PRIORITY_ORDER: TaskPriorityKey[] = [
    "urgent",
    "highest",
    "high",
    "medium",
    "low",
    "lowest",
];

export function priorityToken(priority: string | undefined): PriorityToken {
    return TASK_PRIORITY[priority as TaskPriorityKey] ?? TASK_PRIORITY.medium;
}

export interface StatusToken {
    label: string;
    bg: string;
    fg: string;
    border: string;
    dot: string;
}

const TO_DO_STATUS: Omit<StatusToken, "label"> = {
    bg: T.GRAY,
    fg: T.TEXT_MUTED,
    border: T.GRAY_MID,
    dot: T.TEXT_HINT,
};

/**
 * Status colours keyed by taskboard column slug. Columns are configurable
 * per install, so `statusToken()` falls back to the neutral "to do" tone for
 * any slug the design didn't anticipate.
 */
export const TASK_STATUS: Record<string, StatusToken> = {
    to_do: { label: "To do", ...TO_DO_STATUS },
    incomplete: { label: "To do", ...TO_DO_STATUS },
    in_progress: {
        label: "In progress",
        bg: T.BLUE_LIGHT,
        fg: T.BLUE_DARK,
        border: T.BLUE_MID,
        dot: T.BLUE,
    },
    waiting: {
        label: "Waiting",
        bg: T.AMBER_BANNER,
        fg: T.AMBER,
        border: T.AMBER_MID,
        dot: T.AMBER_TEXT,
    },
    done: {
        label: "Done",
        bg: T.GREEN_LIGHT,
        fg: T.GREEN,
        border: T.GREEN_MID,
        dot: T.GREEN,
    },
};

export function statusToken(slug: string | undefined): StatusToken {
    return TASK_STATUS[slug ?? "to_do"] ?? TASK_STATUS.to_do;
}

export interface CategoryToken {
    label: string;
    d: string;
    dot: string;
    bg: string;
    fg: string;
    border: string;
}

/**
 * Category tags all share this one accent — `task_categories` rows have no
 * colour of their own, so categories are distinguished by label text only,
 * not by hue. It's the same blue used for a selected option everywhere else
 * (status/priority pills), so a chosen category reads as "selected" in the
 * picker the same way the others do, instead of looking inert.
 */
const CATEGORY_STYLE = {
    d: TASK_ICON.note,
    dot: T.BLUE,
    bg: T.BLUE_LIGHT,
    fg: T.BLUE_DARK,
    border: T.BLUE_MID,
};

export const UNCATEGORISED_LABEL = "Uncategorised";

/** Null when the task has no category — callers should omit the tag entirely
 *  rather than inventing one. */
export function categoryToken(name: string | undefined): CategoryToken | null {
    if (!name) return null;
    return { label: name, ...CATEGORY_STYLE };
}

export type TaskBucketKey =
    "overdue" | "today" | "upcoming" | "unscheduled" | "done";

export interface BucketToken {
    key: TaskBucketKey;
    label: string;
    dot: string;
    fg: string;
}

export const TASK_BUCKETS: BucketToken[] = [
    { key: "overdue", label: "Overdue", dot: T.RED, fg: T.RED },
    { key: "today", label: "Due today", dot: T.AMBER_TEXT, fg: T.AMBER },
    { key: "upcoming", label: "Upcoming", dot: T.BLUE, fg: T.TEXT_MUTED },
    { key: "unscheduled", label: "Unscheduled", dot: T.TEXT_HINT, fg: T.TEXT_MUTED },
    { key: "done", label: "Completed", dot: T.GREEN, fg: T.TEXT_MUTED },
];

/** Linked-record types, with the icon + tint the design gives each. */
export const RECORD_TYPES = {
    lead: {
        label: "Lead",
        plural: "leads",
        d: TASK_ICON.user,
        iconBg: T.BLUE_LIGHT,
        iconFg: T.BLUE_DARK,
    },
    deal: {
        label: "Deal",
        plural: "deals",
        d: TASK_ICON.euro,
        iconBg: T.GREEN_LIGHT,
        iconFg: T.GREEN,
    },
    property: {
        label: "Property",
        plural: "properties",
        d: TASK_ICON.building,
        iconBg: T.NAVY_SOFT,
        iconFg: T.NAVY,
    },
    project: {
        label: "Project",
        plural: "projects",
        d: TASK_ICON.pin,
        iconBg: T.AMBER_BG,
        iconFg: T.AMBER,
    },
} as const;

export type RecordTypeKey = keyof typeof RECORD_TYPES;

/**
 * Soft avatar tones, cycled per person (the design's AVATAR_TONES). Assigned
 * deterministically by user id so the same colleague keeps the same tint.
 */
export const ASSIGNEE_TONES = [
    { bg: T.BLUE_LIGHT, fg: T.BLUE_DARK },
    { bg: T.GREEN_LIGHT, fg: T.GREEN },
    { bg: T.NAVY_SOFT, fg: T.NAVY },
    { bg: T.TEAL_SOFT, fg: T.TEAL },
] as const;

export function assigneeTone(userId: number): { bg: string; fg: string } {
    return ASSIGNEE_TONES[Math.abs(userId) % ASSIGNEE_TONES.length];
}

/** Row vertical padding per density option (design default: comfortable). */
export const ROW_PADDING = {
    comfortable: "13px",
    compact: "9px",
} as const;

export type DensityOption = keyof typeof ROW_PADDING;
