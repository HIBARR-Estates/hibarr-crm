import { generatePropertySubtitle } from "@/lib/utils";
import type { PropertySummary } from "@/Types/api/deals";

/**
 * How an attached property reads in the Deal info list and the Dossier rail.
 *
 * `property.title` is machine-generated — the type plus the unit type's
 * reference code ("apartment - AKACAN-002-UT03") — so it is an identifier, not
 * a name. The attach picker and the offers tab already show a property as its
 * generated subtitle ("3 Bed Apartment with Sea View"); these keep the deal
 * surfaces reading the same way.
 */
export function propertyDisplayName(
    prop: PropertySummary | undefined,
    fallback: string,
): string {
    if (!prop) return fallback;

    return generatePropertySubtitle(prop) || prop.title || fallback;
}

/**
 * "Gecitkoy, Kyrenia" — the property's own city/area columns are usually
 * empty, so this leans on the appended `effective_location` accessor (project
 * location first) and falls back to the columns.
 */
export function propertyDisplayLocation(
    prop: PropertySummary | undefined,
): string | null {
    if (!prop) return null;

    const parts = [
        prop.effective_location?.area || prop.area,
        prop.effective_location?.city || prop.city,
    ]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));

    // The accessor often returns "gecitkoy, kyrenia" as the city already, so a
    // naive join would repeat the area.
    const unique = parts.filter((part, index) => parts.indexOf(part) === index);

    return unique.length ? unique.join(", ") : null;
}
