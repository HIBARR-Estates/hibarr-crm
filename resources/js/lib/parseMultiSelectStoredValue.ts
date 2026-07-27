/**
 * Normalize stored multi-value custom field data (checkbox / multiselect /
 * multiSelectCountry) into a string array.
 *
 * Storage is JSON arrays going forward. Legacy checkbox rows used
 * comma+space joined strings (`"A, B"`), so those are still accepted.
 */
export function parseMultiSelectStoredValue(value: unknown): string[] {
    if (value == null || value === "") return [];

    if (Array.isArray(value)) {
        return value
            .map((item) =>
                item == null ? "" : typeof item === "string" ? item : String(item),
            )
            .map((item) => item.trim())
            .filter(Boolean);
    }

    if (typeof value !== "string") {
        return [String(value)].filter(Boolean);
    }

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
            return parseMultiSelectStoredValue(parsed);
        }
    } catch {
        // Legacy checkbox: "Option A, Option B"
    }

    if (trimmed.includes(",")) {
        return trimmed
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);
    }

    return [trimmed];
}
