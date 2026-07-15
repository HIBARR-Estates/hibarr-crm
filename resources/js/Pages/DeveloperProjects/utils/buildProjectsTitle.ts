import { snakeToReadable } from "@/lib/utils";

/** Match ProjectCard price formatting for title clauses. */
export function formatProjectsPrice(amount: number | string): string {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
    }).format(Number(amount));
}

export interface ProjectsTitleFilters {
    developerName?: string | null;
    city?: string | null;
    area?: string | null;
    statusLabel?: string | null;
    categoryLabel?: string | null;
    priceMin?: string | null;
    priceMax?: string | null;
    planMonths?: string | null;
}

export interface ProjectsTitleResult {
    /** Full sentence including leading "Projects", or plain "Projects" */
    sentence: string;
    /** Clauses after "Projects " — empty when no filters */
    filterSummary: string;
    /** When true, keep H1 as "Projects" and show filterSummary as subtitle */
    useSubtitle: boolean;
}

const BULKY_SUMMARY_THRESHOLD = 72;

function displayPlace(value: string): string {
    return snakeToReadable(value.trim()) || value.trim();
}

function buildPriceClause(
    priceMin?: string | null,
    priceMax?: string | null,
): string | null {
    const hasMin = priceMin != null && String(priceMin).trim() !== "";
    const hasMax = priceMax != null && String(priceMax).trim() !== "";
    if (!hasMin && !hasMax) return null;
    if (hasMin && hasMax) {
        return `between ${formatProjectsPrice(priceMin!)} and ${formatProjectsPrice(priceMax!)}`;
    }
    if (hasMax) return `under ${formatProjectsPrice(priceMax!)}`;
    return `over ${formatProjectsPrice(priceMin!)}`;
}

/**
 * Build a plain-language Projects title from active filters.
 * Clause order: developer → location → status → category → price → plan months.
 */
export function buildProjectsTitle(
    filters: ProjectsTitleFilters,
): ProjectsTitleResult {
    const clauses: string[] = [];

    if (filters.developerName?.trim()) {
        clauses.push(`by ${filters.developerName.trim()}`);
    }

    const city = filters.city?.trim();
    const area = filters.area?.trim();
    if (city && area) {
        clauses.push(`in ${displayPlace(area)}, ${displayPlace(city)}`);
    } else if (city) {
        clauses.push(`in ${displayPlace(city)}`);
    }

    if (filters.statusLabel?.trim()) {
        clauses.push(`with status ${filters.statusLabel.trim()}`);
    }

    if (filters.categoryLabel?.trim()) {
        clauses.push(`in the ${filters.categoryLabel.trim()} category`);
    }

    const priceClause = buildPriceClause(filters.priceMin, filters.priceMax);
    if (priceClause) clauses.push(priceClause);

    if (filters.planMonths?.trim()) {
        clauses.push(
            `with ${filters.planMonths.trim()} months payment plan`,
        );
    }

    if (clauses.length === 0) {
        return { sentence: "Projects", filterSummary: "", useSubtitle: false };
    }

    const filterSummary = clauses.join(" ");
    const sentence = `Projects ${filterSummary}`;
    const useSubtitle = filterSummary.length > BULKY_SUMMARY_THRESHOLD;

    return { sentence, filterSummary, useSubtitle };
}

export function countActiveProjectFilters(filters: {
    developerId?: string;
    city?: string;
    area?: string;
    locationId?: string;
    constructionStatus?: string;
    primaryCategory?: string;
    paymentPlanDuration?: string;
    priceMin?: string;
    priceMax?: string;
}): number {
    let count = 0;
    if (filters.developerId) count++;
    if (filters.city) count++;
    if (filters.area) count++;
    if (filters.locationId) count++;
    if (filters.constructionStatus) count++;
    if (filters.primaryCategory) count++;
    if (filters.paymentPlanDuration) count++;
    if (filters.priceMin) count++;
    if (filters.priceMax) count++;
    return count;
}
