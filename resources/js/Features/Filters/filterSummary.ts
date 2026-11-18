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

export interface SummaryI18n {
    t: (key: string, options?: Record<string, any>) => string;
    td: (text: string, options?: { source: "en" }) => string;
}

const EN_SUMMARY: Record<string, string> = {
    summary_between: "{{noun}} between {{a}} and {{b}}",
    summary_after: "{{noun}} after {{a}}",
    summary_before: "{{noun}} before {{a}}",
    summary_is: "{{noun}} is {{value}}",
    summary_contains: "{{noun}} contains “{{value}}”",
    summary_or: "{{a}} or {{b}}",
    summary_one_of: "one of {{n}}",
    untitled_view: "Untitled view",
};

/** English fallback for callers that only need counts (no i18n hooks). */
const EN_I18N: SummaryI18n = {
    t: (key, options = {}) =>
        (EN_SUMMARY[key.split(".").pop() ?? ""] ?? key).replace(
            /\{\{(\w+)\}\}/g,
            (_, name) => String(options[name] ?? ""),
        ),
    td: (text) => text,
};

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

function labelFor(
    field: FilterFieldConfig,
    value: any,
    i18n: SummaryI18n,
): string {
    const match = optionsOf(field).find(
        (option) => String(option.value) === String(value),
    );
    return capitalize(
        i18n.td(match ? String(match.label) : String(value), { source: "en" }),
    );
}

/** "A", "A or B", "one of 4" */
function joinValues(labels: string[], i18n: SummaryI18n): string {
    if (labels.length === 1) return labels[0];
    if (labels.length === 2)
        return i18n.t("pages.filters.summary_or", { a: labels[0], b: labels[1] });
    return i18n.t("pages.filters.summary_one_of", { n: labels.length });
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
    i18n: SummaryI18n = EN_I18N,
): FilterSummaryPart[] {
    if (!config) return [];

    const parts: FilterSummaryPart[] = [];
    const consumed = new Set<string>();

    for (const field of config.fields) {
        if (field.hidden || consumed.has(field.key)) continue;

        const fieldLabel = i18n.td(field.label, { source: "en" });
        const noun = capitalize(
            field.sentence
                ? i18n.td(field.sentence, { source: "en" })
                : fieldLabel.toLowerCase(),
        );

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
                    ? i18n.t("pages.filters.summary_between", { noun, a: start, b: end })
                    : !isEmpty(start)
                      ? i18n.t("pages.filters.summary_after", { noun, a: start })
                      : i18n.t("pages.filters.summary_before", { noun, a: end });
            parts.push({
                keys: [startKey, endKey],
                label: fieldLabel,
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
                    ? i18n.t("pages.filters.summary_between", { noun, a: min, b: max })
                    : !isEmpty(min)
                      ? `${noun} ≥ ${min}`
                      : `${noun} ≤ ${max}`;
            parts.push({
                keys: [`min_${field.key}`, `max_${field.key}`],
                label: fieldLabel,
                text,
                chip: text,
            });
            continue;
        }

        const value = filters[field.key];
        if (isEmpty(value)) continue;
        consumed.add(field.key);

        if (field.control === "segmented" || field.type === "select") {
            const label = labelFor(field, value, i18n);
            parts.push({
                keys: [field.key],
                label: fieldLabel,
                text: i18n.t("pages.filters.summary_is", { noun, value: label }),
                chip: `${fieldLabel}: ${label}`,
            });
            continue;
        }

        if (Array.isArray(value)) {
            const labels = value.map((entry) => labelFor(field, entry, i18n));
            parts.push({
                keys: [field.key],
                label: fieldLabel,
                text: i18n.t("pages.filters.summary_is", {
                    noun,
                    value: joinValues(labels, i18n),
                }),
                chip:
                    labels.length > 2
                        ? `${fieldLabel} · ${labels.length}`
                        : `${fieldLabel}: ${labels.join(", ")}`,
            });
            continue;
        }

        parts.push({
            keys: [field.key],
            label: fieldLabel,
            text: i18n.t("pages.filters.summary_contains", { noun, value }),
            chip: `${fieldLabel}: ${value}`,
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
export function suggestViewName(
    parts: FilterSummaryPart[],
    i18n: SummaryI18n = EN_I18N,
): string {
    if (parts.length === 0) return i18n.t("pages.filters.untitled_view");
    return parts
        .slice(0, 3)
        .map((part) => part.chip.replace(/^[^:]+:\s*/, ""))
        .join(" · ");
}
