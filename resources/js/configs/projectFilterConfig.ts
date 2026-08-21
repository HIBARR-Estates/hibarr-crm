import { FilterConfig, type FilterFieldConfig } from "@/contexts/FilterContext";
import { formatLocationNameForDisplay, snakeToReadable } from "@/lib/utils";

interface LookupOption {
    name: string;
    label: string;
}

interface FilterLocation {
    id: number;
    name: string;
    city?: string | null;
    area?: string | null;
}

interface ProjectFilterProps {
    developers?: Array<{ id: number; name: string }>;
    locations?: FilterLocation[];
    constructionStatuses?: LookupOption[];
    primaryCategories?: LookupOption[];
    titleDeedTypes?: LookupOption[];
    unitTypeOptions?: LookupOption[];
    projectFacilities?: Array<{ name: string; label: string; icon?: string | null }>;
    visibilityEnabled?: boolean;
    canSeeHidden?: boolean;
    /** Currently-selected cities in the draft filter, so area options can cascade. */
    selectedCities?: string[] | string | null;
    excludeFields?: string[];
}

function displayLabel(value: string): string {
    return formatLocationNameForDisplay(value) || snakeToReadable(value) || value;
}

/** Unique, sorted city options from the raw location list. */
function cityOptionsFrom(locations: FilterLocation[]) {
    const seen = new Map<string, string>();
    for (const loc of locations) {
        const raw = loc.city?.trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (!seen.has(key)) seen.set(key, raw);
    }
    return Array.from(seen.values())
        .sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)))
        .map((raw) => ({ value: raw, label: displayLabel(raw) }));
}

/** Area options scoped to whichever cities are currently selected. */
function areaOptionsFrom(locations: FilterLocation[], selectedCities?: string[] | string | null) {
    const cityKeys = (
        Array.isArray(selectedCities)
            ? selectedCities
            : selectedCities
              ? String(selectedCities).split(",")
              : []
    )
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);

    if (cityKeys.length === 0) return [];

    const seen = new Map<string, string>();
    for (const loc of locations) {
        if (!cityKeys.includes((loc.city ?? "").trim().toLowerCase())) continue;
        const raw = loc.area?.trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (!seen.has(key)) seen.set(key, raw);
    }
    return Array.from(seen.values())
        .sort((a, b) => displayLabel(a).localeCompare(displayLabel(b)))
        .map((raw) => ({ value: raw, label: displayLabel(raw) }));
}

/**
 * Schema for the Projects filter modal. Same contract as Leads/Deals
 * (see leadFilterConfig/dealFilterConfig): `type` drives URL/draft state in
 * FilterContext, `control` picks the visual treatment in EntityFilterModal.
 */
export const createProjectFilterConfig = (props: ProjectFilterProps): FilterConfig => {
    const locations = props.locations ?? [];

    const fields: FilterFieldConfig[] = [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search projects by name, description...",
            span: 24,
        },

        // ── Location & Developer ────────────────────────────────
        {
            key: "developer_id",
            label: "Developer",
            type: "multiselect",
            control: "checklist",
            sentence: "developer",
            section: "Location & Developer",
            placeholder: "Search developers…",
            options: (props.developers ?? []).map((d) => ({
                value: d.id,
                label: d.name,
            })),
        },
        {
            key: "city",
            label: "City",
            type: "multiselect",
            control: "checklist",
            sentence: "city",
            section: "Location & Developer",
            placeholder: "Search cities…",
            options: cityOptionsFrom(locations),
        },
        {
            key: "area",
            label: "Area",
            type: "multiselect",
            control: "checklist",
            sentence: "area",
            section: "Location & Developer",
            placeholder: "Select a city first",
            options: areaOptionsFrom(locations, props.selectedCities),
        },

        // ── Category & Status ────────────────────────────────────
        {
            key: "construction_status",
            label: "Construction status",
            type: "multiselect",
            control: "pills",
            sentence: "status",
            section: "Category & Status",
            options: (props.constructionStatuses ?? []).map((s) => ({
                value: s.name,
                label: s.label,
            })),
        },
        {
            key: "primary_category",
            label: "Category",
            type: "multiselect",
            control: "pills",
            sentence: "category",
            section: "Category & Status",
            options: (props.primaryCategories ?? []).map((c) => ({
                value: c.name,
                label: c.label,
            })),
        },
        {
            key: "title_deed_type",
            label: "Title deed type",
            type: "multiselect",
            control: "pills",
            sentence: "title deed type",
            section: "Category & Status",
            options: (props.titleDeedTypes ?? []).map((t) => ({
                value: t.name,
                label: t.label,
            })),
        },

        // ── Delivery ─────────────────────────────────────────────
        {
            key: "completion_start",
            label: "Completion date",
            type: "date",
            control: "datePresets",
            rangeKeys: ["completion_start", "completion_end"],
            sentence: "completion date",
            section: "Delivery",
        },
        { key: "completion_end", label: "Completion date to", type: "date", hidden: true },
        {
            key: "number_of_phases",
            label: "Phases",
            type: "numberrange",
            control: "scoreRange",
            sentence: "phases",
            section: "Delivery",
        },

        // ── Unit Mix ─────────────────────────────────────────────
        {
            key: "unit_types",
            label: "Unit types",
            type: "multiselect",
            control: "pills",
            sentence: "unit type",
            section: "Unit Mix",
            options: (props.unitTypeOptions ?? []).map((u) => ({
                value: u.name,
                label: u.label,
            })),
        },
        {
            key: "total_units",
            label: "Total units",
            type: "numberrange",
            control: "scoreRange",
            sentence: "total units",
            section: "Unit Mix",
        },

        // ── Pricing & Payment Plan ───────────────────────────────
        {
            key: "starting_price",
            label: "Starting price",
            type: "numberrange",
            control: "scoreRange",
            sentence: "starting price",
            section: "Pricing & Payment Plan",
        },
        {
            key: "payment_plan_duration",
            label: "Plan months",
            type: "numberrange",
            control: "scoreRange",
            sentence: "plan months",
            section: "Pricing & Payment Plan",
        },
        {
            key: "downpayment_type",
            label: "Downpayment type",
            type: "select",
            control: "segmented",
            sentence: "downpayment type",
            section: "Pricing & Payment Plan",
            options: [
                { value: "percentage", label: "Percentage" },
                { value: "amount", label: "Fixed amount" },
            ],
        },
        {
            key: "rental_guarantee",
            label: "Rental guarantee",
            type: "select",
            control: "segmented",
            sentence: "rental guarantee",
            section: "Pricing & Payment Plan",
            options: [
                { value: "1", label: "Guaranteed" },
                { value: "0", label: "Not guaranteed" },
            ],
        },

        // ── Facilities & Visibility ──────────────────────────────
        {
            key: "facilities",
            label: "Facilities",
            type: "multiselect",
            control: "checklist",
            sentence: "facility",
            section: "Facilities & Visibility",
            placeholder: "Search facilities…",
            options: (props.projectFacilities ?? []).map((f) => ({
                value: f.name,
                label: f.label,
            })),
        },
        ...(props.visibilityEnabled && props.canSeeHidden
            ? [
                  {
                      key: "is_hidden",
                      label: "Visibility",
                      type: "select" as const,
                      control: "segmented" as const,
                      sentence: "visibility",
                      section: "Facilities & Visibility",
                      options: [
                          { value: "1", label: "Hidden" },
                          { value: "0", label: "Visible" },
                      ],
                  },
              ]
            : []),
    ];

    return {
        routeName: "developer-projects.index",
        title: "Project Filters",
        fields,
        excludeFields: props.excludeFields,
        defaultValues: {},
    };
};

export default createProjectFilterConfig;
