import type { FilterConfig, FilterFieldConfig } from "@/contexts/FilterContext";

export interface FilterSummaryPart {
    /** The filter key(s) this part describes — removing it clears all of them. */
    keys: string[];
    /** Short label, e.g. "Status". */
    label: string;
    /** Full clause, e.g. "status is one of 4". */
    text: string;
    /** Compact chip text, e.g. "Status · 2". */
    chip: string;
}

function optionsOf(field: FilterFieldConfig) {
    const options =
        typeof field.options === "function" ? field.options() : field.options;
    return options ?? [];
}

/** "todo" -> "Todo" — option labels can come straight from user data
 *  (e.g. a board column's raw name), so the sentence can't assume they're
 *  already capitalized. */
function capitalize(text: string): string {
    if (!text) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function labelFor(field: FilterFieldConfig, value: any): string {
    const match = optionsOf(field).find(
        (option) => String(option.value) === String(value),
    );
    return capitalize(match ? String(match.label) : String(value));
}

/** "A", "A or B", "one of 4" */
function joinValues(labels: string[]): string {
    if (labels.length === 1) return labels[0];
    if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
    return `one of ${labels.length}`;
}

function isEmpty(value: any): boolean {
    return (
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Describe the active filters in plain language. Powers the table's filter
 * sentence, the modal's "Reading as" panel, and saved-view chip lists.
 */
export function describeFilters(
    config: FilterConfig | null,
    filters: Record<string, any>,
): FilterSummaryPart[] {
    if (!config) return [];

    const parts: FilterSummaryPart[] = [];
    const consumed = new Set<string>();

    for (const field of config.fields) {
        if (field.hidden || consumed.has(field.key)) continue;

        const noun = capitalize(field.sentence ?? field.label.toLowerCase());

        // Date range spans two keys.
        if (field.control === "datePresets") {
            const [startKey, endKey] = field.rangeKeys ?? [
                "start_date",
                "end_date",
            ];
            const start = filters[startKey];
            const end = filters[endKey];
            if (isEmpty(start) && isEmpty(end)) continue;
            consumed.add(startKey);
            consumed.add(endKey);

            const text =
                !isEmpty(start) && !isEmpty(end)
                    ? `${noun} between ${start} and ${end}`
                    : !isEmpty(start)
                      ? `${noun} after ${start}`
                      : `${noun} before ${end}`;
            parts.push({
                keys: [startKey, endKey],
                label: field.label,
                text,
                chip: !isEmpty(start) && !isEmpty(end) ? `${start} → ${end}` : text,
            });
            continue;
        }

        // Numeric range spans min_*/max_*.
        if (field.control === "scoreRange") {
            const min = filters[`min_${field.key}`];
            const max = filters[`max_${field.key}`];
            if (isEmpty(min) && isEmpty(max)) continue;
            consumed.add(`min_${field.key}`);
            consumed.add(`max_${field.key}`);

            const text =
                !isEmpty(min) && !isEmpty(max)
                    ? `${noun} between ${min} and ${max}`
                    : !isEmpty(min)
                      ? `${noun} ≥ ${min}`
                      : `${noun} ≤ ${max}`;
            parts.push({
                keys: [`min_${field.key}`, `max_${field.key}`],
                label: field.label,
                text,
                chip: text,
            });
            continue;
        }

        const value = filters[field.key];
        if (isEmpty(value)) continue;
        consumed.add(field.key);

        if (field.control === "segmented" || field.type === "select") {
            const label = labelFor(field, value);
            parts.push({
                keys: [field.key],
                label: field.label,
                text: `${noun} is ${label}`,
                chip: `${field.label}: ${label}`,
            });
            continue;
        }

        if (Array.isArray(value)) {
            const labels = value.map((entry) => labelFor(field, entry));
            parts.push({
                keys: [field.key],
                label: field.label,
                text: `${noun} is ${joinValues(labels)}`,
                chip:
                    labels.length > 2
                        ? `${field.label} · ${labels.length}`
                        : `${field.label}: ${labels.join(", ")}`,
            });
            continue;
        }

        parts.push({
            keys: [field.key],
            label: field.label,
            text: `${noun} contains “${value}”`,
            chip: `${field.label}: ${value}`,
        });
    }

    return parts;
}

/** "status is one of 4 and category is Disqualified or Qualified" */
export function joinSentence(parts: FilterSummaryPart[]): string {
    const texts = parts.map((part) => part.text);
    if (texts.length === 0) return "";
    if (texts.length === 1) return texts[0];
    return `${texts.slice(0, -1).join(", ")} and ${texts[texts.length - 1]}`;
}

/** Name suggestion for "Save as view", built from the strongest filters. */
export function suggestViewName(parts: FilterSummaryPart[]): string {
    if (parts.length === 0) return "Untitled view";
    return parts
        .slice(0, 3)
        .map((part) => part.chip.replace(/^[^:]+:\s*/, ""))
        .join(" · ");
}
