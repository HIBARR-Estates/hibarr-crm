import type { DealInfoCoreSectionId, DealInfoSectionId } from "../types";

/** First N core sections appear under "Now — in progress". Adjust when field-to-section mapping is formalized. */
export const DEAL_INFO_NOW_SECTION_COUNT = 3;

/**
 * Optional mapping from custom field category id → core section id.
 * Pipeline `customFieldCategories` are the existing categorization mechanism;
 * unmapped categories appear as separate nav items under "Later stages".
 *
 * `deal.stage_focus` (stage → field keys) is used elsewhere for stage completion
 * tracking but does not assign fields to deal-info sections.
 */
export const DEAL_INFO_CATEGORY_SECTION_MAP: Partial<
    Record<number, DealInfoCoreSectionId>
> = {};

export interface DealInfoNavItemConfig {
    id: DealInfoSectionId;
    label: string;
    icon: string;
    badgeVariant: "blue" | "gray";
    later?: boolean;
    /** Static badge for later-stage sections (e.g. Prospect / Customer). */
    stageBadge?: string;
}

/**
 * "gdpr" is deliberately absent — it is appended manually as the very last
 * nav item (after unmapped categories), matching v2.2's sidebar order.
 */
export const DEAL_INFO_CORE_SECTION_ORDER: DealInfoCoreSectionId[] = [
    "general",
    // "experience",
    // "income",
    // "location",
    "preftimeline",
];

/**
 * Section titles. Subtitles are computed dynamically in
 * DealInfoSectionPanel (v2.2's lock/gdpr-aware copy, deal-v2-2.jsx:3417-3420)
 * rather than stored per section here.
 */
export const DEAL_INFO_SECTION_TITLES: Record<DealInfoCoreSectionId, string> = {
    general: "General information",
    gdpr: "GDPR & consents",
    experience: "Investment experience & goals",
    income: "Income & savings",
    location: "Location & building preference",
    preftimeline: "Preferences & timeline",
    funding: "Funding & liquidity",
    support: "Support & collaboration",
};

const CORE_NAV_ICONS: Record<DealInfoCoreSectionId, string> = {
    general: "info",
    experience: "award",
    income: "wallet",
    location: "map-pin",
    preftimeline: "clock",
    funding: "bank",
    support: "lifebuoy",
    gdpr: "check-square",
};

const CORE_NAV_LABELS: Record<DealInfoCoreSectionId, string> = {
    general: "General info",
    experience: "Inv. experience",
    income: "Income & savings",
    location: "Location pref.",
    preftimeline: "Pref. & timeline",
    funding: "Funding & liquidity",
    support: "Support & collab.",
    gdpr: "GDPR & consents",
};

/**
 * Built-in (non-custom) field labels per core section — feeds the sidebar
 * search so queries match field names as well as section names (v2.2's
 * "Search sections & fields…" behaviour).
 */
export const CORE_SECTION_FIELD_LABELS: Partial<
    Record<DealInfoCoreSectionId, string[]>
> = {
    general: [
        "Deal name",
        "Close date",
        "Category",
        "Packages",
        "Properties",
    ],
    preftimeline: [
        "Purchase timeline",
        "Strategy meeting booked",
        "Motivation",
        "Downpayment paid",
        "Inspection trip date",
        "Interested in",
        "Budget range",
    ],
    funding: [
        "Deposit confirmation",
        "Reservation agreement",
        "Sales contract",
    ],
    support: ["Message", "Deal agent", "Participants", "Watchers"],
    gdpr: ["Consents", "Marketing", "Data processing"],
};

const LATER_STAGE_BADGES: Partial<Record<DealInfoCoreSectionId, string>> = {
    location: "Prospect",
    preftimeline: "Prospect",
    funding: "Customer",
    support: "Customer",
};

export function isCategorySectionId(
    id: DealInfoSectionId,
): id is `category-${number}` {
    return typeof id === "string" && id.startsWith("category-");
}

export function parseCategorySectionId(id: string): number | null {
    const match = /^category-(\d+)$/.exec(id);
    return match ? Number(match[1]) : null;
}

export function toCategorySectionId(categoryId: number): DealInfoSectionId {
    return `category-${categoryId}`;
}

export function buildCoreNavItem(
    id: DealInfoCoreSectionId,
    later: boolean,
): DealInfoNavItemConfig {
    return {
        id,
        label: CORE_NAV_LABELS[id],
        icon: CORE_NAV_ICONS[id],
        badgeVariant: later ? "gray" : "blue",
        later,
        stageBadge: later ? LATER_STAGE_BADGES[id] : undefined,
    };
}

export function getUnmappedCategories(
    categories: Array<{ id: number; name: string }>,
): Array<{ id: number; name: string }> {
    const mappedIds = new Set(
        Object.keys(DEAL_INFO_CATEGORY_SECTION_MAP).map(Number),
    );
    return categories.filter((category) => !mappedIds.has(category.id));
}

export function getCategoriesForCoreSection(
    sectionId: DealInfoCoreSectionId,
    categories: Array<{ id: number; name: string }>,
): Array<{ id: number; name: string }> {
    return categories.filter(
        (category) => DEAL_INFO_CATEGORY_SECTION_MAP[category.id] === sectionId,
    );
}
