import createProjectFilterConfig from "@/configs/projectFilterConfig";
import type { FilterConfig, FilterFieldConfig } from "@/contexts/FilterContext";
import type { BrowseOptions, NamedOption, ProjectOptions } from "./types";

const PRICES = [150000, 200000, 250000, 350000, 500000, 750000, 1000000];
const BEDROOMS = [1, 2, 3, 4];

/** The in-list search lives on the page; it rides along in the URL but is not a field of the modal. */
const SEARCH_FIELD: FilterFieldConfig = { key: "search", label: "Search", type: "text", hidden: true };

const named = (list: NamedOption[] | undefined) => (list ?? []).map((item) => ({ value: item.name, label: item.label }));

/**
 * The Browse filters: the same fields the old filter row had, laid out in the
 * workspace's shared filter modal. Keys and values are the ones the Portfolio
 * controller reads, so applying is a visit of /agent/portfolio/browse.
 */
export function createBrowseFilterConfig(options: BrowseOptions | undefined): FilterConfig {
    return {
        routeName: "agent.portfolio.browse",
        title: "Property filters",
        only: ["properties", "filters", "options"],
        fields: [
            SEARCH_FIELD,
            {
                key: "city",
                label: "City",
                type: "multiselect",
                control: "checklist",
                sentence: "city",
                section: "Location",
                placeholder: "Search cities…",
                options: named(options?.cities),
            },
            {
                key: "area",
                label: "Area",
                type: "multiselect",
                control: "checklist",
                sentence: "area",
                section: "Location",
                placeholder: "Search areas…",
                options: named(options?.areas),
            },
            {
                key: "max_price",
                label: "Price up to",
                type: "select",
                control: "select",
                sentence: "price",
                section: "Price & size",
                placeholder: "Any price",
                options: PRICES.map((price) => ({ value: String(price), label: price >= 1000000 ? `${price / 1000000}M` : `${price / 1000}k` })),
            },
            {
                key: "min_bedrooms",
                label: "Bedrooms",
                type: "select",
                control: "segmented",
                sentence: "bedrooms",
                section: "Price & size",
                options: BEDROOMS.map((count) => ({ value: String(count), label: `${count}+` })),
            },
            {
                key: "construction_status",
                label: "Construction status",
                type: "multiselect",
                control: "pills",
                sentence: "status",
                section: "Status",
                options: named(options?.construction_statuses),
            },
            {
                key: "deed_status",
                label: "Deed status",
                type: "select",
                control: "select",
                sentence: "deed",
                section: "Status",
                placeholder: "Any deed status",
                options: named(options?.deed_statuses),
            },
            {
                key: "developer_id",
                label: "Developer",
                type: "select",
                control: "select",
                sentence: "developer",
                section: "Developer",
                placeholder: "Any developer",
                options: (options?.developers ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            },
        ],
    };
}

/** The Projects page's fields, taken from the Projects list's own filter schema. */
const PROJECT_FIELDS = new Set(["developer_id", "city", "area", "construction_status", "completion_start", "completion_end", "starting_price", "bedrooms", "total_units"]);

/**
 * The Projects filters: the Projects list's filter schema narrowed to the
 * fields the cards can answer for, so a filter means the same as there.
 */
export function createProjectsFilterConfig(options: ProjectOptions | undefined): FilterConfig {
    const base = createProjectFilterConfig({
        developers: options?.developers,
        locations: options?.locations ?? [],
        constructionStatuses: options?.construction_statuses,
    });

    return {
        ...base,
        routeName: "agent.portfolio.projects",
        title: "Project filters",
        only: ["projects", "filters", "options"],
        fields: [SEARCH_FIELD, ...base.fields.filter((field) => PROJECT_FIELDS.has(field.key))],
    };
}
