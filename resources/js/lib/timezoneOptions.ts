import type { SearchableSelectGroup } from "@/Components/Redesign/primitives/SearchableSelect";
import { timezoneUtcOffset } from "@/lib/timezoneLabel";

/**
 * IANA timezones grouped by region for a SearchableSelect. Uses the browser's
 * own list when available, with a short fallback for older engines.
 */
export function buildTimezoneGroups(): SearchableSelectGroup[] {
    let zones: string[] = [];
    try {
        if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
            zones = (
                Intl as unknown as {
                    supportedValuesOf: (key: string) => string[];
                }
            ).supportedValuesOf("timeZone");
        }
    } catch {
        zones = [];
    }
    if (zones.length === 0) {
        zones = [
            "UTC",
            "Europe/Berlin",
            "Europe/London",
            "America/New_York",
            "America/Los_Angeles",
            "Asia/Dubai",
            "Asia/Tokyo",
            "Australia/Sydney",
        ];
    }

    const now = new Date();
    const grouped = new Map<string, { value: string; label: string }[]>();
    for (const zone of zones) {
        const region = zone.split("/")[0] ?? "Other";
        const list = grouped.get(region) ?? [];
        // Live (DST-aware) offset in the label, so it shows in the list and
        // is searchable ("UTC+3").
        list.push({
            value: zone,
            label: `${zone.replace(/_/g, " ")} (${timezoneUtcOffset(zone, now)})`,
        });
        grouped.set(region, list);
    }

    return Array.from(grouped.entries()).map(([label, options]) => ({
        label,
        options,
    }));
}
