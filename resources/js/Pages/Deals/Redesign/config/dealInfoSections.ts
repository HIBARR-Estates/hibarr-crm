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

export interface DealInfoSectionMeta {
    title: string;
    subtitle: string;
}

export const DEAL_INFO_CORE_SECTION_ORDER: DealInfoCoreSectionId[] = [
    "general",
    // "experience",
    // "income",
    // "location",
    "preftimeline",
    "funding",
    "support",
];

export const DEAL_INFO_SECTION_META: Record<
    DealInfoCoreSectionId,
    DealInfoSectionMeta
> = {
    general: {
        title: "General information",
        subtitle: "Stage relevant — In progress",
    },
    experience: {
        title: "Investment experience & goals",
        subtitle: "Stage relevant — In progress",
    },
    income: {
        title: "Income & savings",
        subtitle: "Stage relevant — In progress",
    },
    location: {
        title: "Location & building preference",
        subtitle: "Becomes relevant at Prospect stage",
    },
    preftimeline: {
        title: "Preferences & timeline",
        subtitle: "Becomes relevant at Prospect stage",
    },
    funding: {
        title: "Funding & liquidity",
        subtitle: "Becomes relevant at Customer stage",
    },
    support: {
        title: "Support & collaboration",
        subtitle: "Becomes relevant at Customer stage",
    },
};

const CORE_NAV_ICONS: Record<DealInfoCoreSectionId, string> = {
    general: "info",
    experience: "award",
    income: "wallet",
    location: "map-pin",
    preftimeline: "clock",
    funding: "bank",
    support: "lifebuoy",
};

const CORE_NAV_LABELS: Record<DealInfoCoreSectionId, string> = {
    general: "General info",
    experience: "Inv. experience",
    income: "Income & savings",
    location: "Location pref.",
    preftimeline: "Pref. & timeline",
    funding: "Funding & liquidity",
    support: "Support & collab.",
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
