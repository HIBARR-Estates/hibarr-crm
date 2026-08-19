/**
 * Design tokens for the Tasks workspace redesign.
 *
 * Values are transcribed 1:1 from the `Tasks Workspace Redesign.dc.html`
 * handoff (its ICON / PRIORITY / STATUS / CATEGORIES / BUCKETS maps) so the
 * implementation matches the Claude Design template exactly. Don't "tidy"
 * these hexes — they are the design's source of truth.
 */

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
    inboxEmpty: "M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l2-4h14l2 4M9 12h6",
    filter: "M22 3H2l8 9.46V19l4 2v-8.54z",
    list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
    board: "M4 4h6v16H4zM14 4h6v9h-6z",
    refresh: "M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5",
    plus: "M12 5v14M5 12h14",
    chevron: "m6 9 6 6 6-6",
    x: "M18 6 6 18M6 6l12 12",
    more: "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
    externalLink: "M7 17 17 7M7 7h10v10",
    edit: "M18 2l4 4-11 11H7v-4zM3 21h18",
    check: "M20 6 9 17l-5-5",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
} as const;

export type TaskPriorityKey =
    | "urgent"
    | "highest"
    | "high"
    | "medium"
    | "low"
    | "lowest";

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
        color: "#b91c1c",
        bg: "#fef2f2",
        fg: "#b91c1c",
        border: "#fecaca",
    },
    highest: {
        label: "Highest",
        d: TASK_ICON.prioHighest,
        color: "#c2410c",
        bg: "#fff7ed",
        fg: "#9a3412",
        border: "#fed7aa",
    },
    high: {
        label: "High",
        d: TASK_ICON.prioHigh,
        color: "#a16207",
        bg: "#fefce8",
        fg: "#854d0e",
        border: "#fde68a",
    },
    medium: {
        label: "Medium",
        d: TASK_ICON.prioMedium,
        color: "#1a6bb5",
        bg: "#e8f1fb",
        fg: "#14538c",
        border: "#b8d4f0",
    },
    low: {
        label: "Low",
        d: TASK_ICON.prioLow,
        color: "#0f766e",
        bg: "#e6f7f5",
        fg: "#0f766e",
        border: "#99e2d8",
    },
    lowest: {
        label: "Lowest",
        d: TASK_ICON.prioLowest,
        color: "#9ca3af",
        bg: "#f5f6f8",
        fg: "#5b6472",
        border: "#e8eaed",
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

/**
 * Status colours keyed by taskboard column slug. Columns are configurable
 * per install, so `statusToken()` falls back to the neutral "to do" tone for
 * any slug the design didn't anticipate.
 */
export const TASK_STATUS: Record<string, StatusToken> = {
    to_do: {
        label: "To do",
        bg: "#f5f6f8",
        fg: "#5b6472",
        border: "#e8eaed",
        dot: "#9ca3af",
    },
    incomplete: {
        label: "To do",
        bg: "#f5f6f8",
        fg: "#5b6472",
        border: "#e8eaed",
        dot: "#9ca3af",
    },
    in_progress: {
        label: "In progress",
        bg: "#e8f1fb",
        fg: "#14538c",
        border: "#b8d4f0",
        dot: "#1a6bb5",
    },
    waiting: {
        label: "Waiting",
        bg: "#fef3c7",
        fg: "#92400e",
        border: "#fed7aa",
        dot: "#b45309",
    },
    done: {
        label: "Done",
        bg: "#e1f5ee",
        fg: "#177a5b",
        border: "#9fe1cb",
        dot: "#177a5b",
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
 * The design's five reference categories. Real installs define their own
 * `task_categories` rows, so `categoryToken()` matches on name and otherwise
 * assigns a stable colour from this same palette by hashing the name — the
 * category tag stays colourful and consistent without inventing new hues.
 */
export const TASK_CATEGORIES: Record<string, CategoryToken> = {
    follow_up: {
        label: "Follow-up",
        d: TASK_ICON.phone,
        dot: "#1a6bb5",
        bg: "#e8f1fb",
        fg: "#14538c",
        border: "#b8d4f0",
    },
    viewing: {
        label: "Viewing",
        d: TASK_ICON.pin,
        dot: "#0f766e",
        bg: "#e6f7f5",
        fg: "#0f766e",
        border: "#99e2d8",
    },
    documents: {
        label: "Documents",
        d: TASK_ICON.file,
        dot: "#16294d",
        bg: "#e8ecf2",
        fg: "#16294d",
        border: "#c7d0de",
    },
    payments: {
        label: "Payments",
        d: TASK_ICON.euro,
        dot: "#177a5b",
        bg: "#e1f5ee",
        fg: "#177a5b",
        border: "#9fe1cb",
    },
    admin: {
        label: "Admin",
        d: TASK_ICON.note,
        dot: "#b45309",
        bg: "#fffbeb",
        fg: "#92400e",
        border: "#fde68a",
    },
};

const CATEGORY_PALETTE = Object.values(TASK_CATEGORIES);

export function categoryToken(name: string | undefined): CategoryToken {
    if (!name) return TASK_CATEGORIES.admin;

    const normalized = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const direct = TASK_CATEGORIES[normalized];
    if (direct) return { ...direct, label: name };

    const byLabel = CATEGORY_PALETTE.find(
        (token) => token.label.toLowerCase() === name.trim().toLowerCase(),
    );
    if (byLabel) return byLabel;

    // Stable colour per unseen category name.
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
        hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    return {
        ...CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length],
        label: name,
    };
}

export type TaskBucketKey =
    | "overdue"
    | "today"
    | "upcoming"
    | "unscheduled"
    | "done";

export interface BucketToken {
    key: TaskBucketKey;
    label: string;
    dot: string;
    fg: string;
}

export const TASK_BUCKETS: BucketToken[] = [
    { key: "overdue", label: "Overdue", dot: "#b91c1c", fg: "#b91c1c" },
    { key: "today", label: "Due today", dot: "#b45309", fg: "#92400e" },
    { key: "upcoming", label: "Upcoming", dot: "#1a6bb5", fg: "#5b6472" },
    { key: "unscheduled", label: "Unscheduled", dot: "#9ca3af", fg: "#5b6472" },
    { key: "done", label: "Completed", dot: "#177a5b", fg: "#5b6472" },
];

/** Linked-record types, with the icon + tint the design gives each. */
export const RECORD_TYPES = {
    lead: {
        label: "Lead",
        plural: "leads",
        d: TASK_ICON.user,
        iconBg: "#e8f1fb",
        iconFg: "#14538c",
    },
    deal: {
        label: "Deal",
        plural: "deals",
        d: TASK_ICON.euro,
        iconBg: "#e1f5ee",
        iconFg: "#177a5b",
    },
    property: {
        label: "Property",
        plural: "properties",
        d: TASK_ICON.building,
        iconBg: "#e8ecf2",
        iconFg: "#16294d",
    },
    project: {
        label: "Project",
        plural: "projects",
        d: TASK_ICON.pin,
        iconBg: "#fffbeb",
        iconFg: "#92400e",
    },
} as const;

export type RecordTypeKey = keyof typeof RECORD_TYPES;

/**
 * Soft avatar tones, cycled per person (the design's AVATAR_TONES). Assigned
 * deterministically by user id so the same colleague keeps the same tint.
 */
export const ASSIGNEE_TONES = [
    { bg: "#e8f1fb", fg: "#14538c" },
    { bg: "#e1f5ee", fg: "#177a5b" },
    { bg: "#e8ecf2", fg: "#16294d" },
    { bg: "#e6f7f5", fg: "#0f766e" },
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
