import { FilterConfig, type FilterFieldConfig } from "@/contexts/FilterContext";

const YES_NO_OPTIONS = [
    { value: "1", label: "Yes" },
    { value: "0", label: "No" },
];

const OPTION_CUSTOM_FIELD_TYPES = new Set([
    "select",
    "radio",
    "checkbox",
    "multiselect",
]);

type LeadCustomFieldDef = {
    id: number;
    label?: string;
    name?: string;
    type?: string;
    values?: unknown;
};

function optionValuesOf(field: LeadCustomFieldDef): string[] {
    const raw = field.values;
    if (!Array.isArray(raw)) return [];
    return raw
        .map((value) => String(value ?? "").trim())
        .filter((value) => value !== "");
}

/** Option-valued lead custom fields → filter controls under Custom Fields. */
export function buildLeadCustomFieldFilterFields(
    customFields: LeadCustomFieldDef[] = [],
): FilterFieldConfig[] {
    return customFields
        .filter(
            (field) =>
                OPTION_CUSTOM_FIELD_TYPES.has(String(field.type ?? "")) &&
                optionValuesOf(field).length > 0,
        )
        .map((field) => {
            const options = optionValuesOf(field).map((value) => ({
                value,
                label: value,
            }));

            return {
                key: `cf_${field.id}`,
                label: field.label || field.name || `Field ${field.id}`,
                type: "multiselect" as const,
                control:
                    options.length > 12
                        ? ("checklist" as const)
                        : ("pills" as const),
                sentence: (
                    field.label ||
                    field.name ||
                    "custom field"
                ).toLowerCase(),
                section: "Custom Fields",
                options,
            };
        });
}

/**
 * Schema for the Leads filter modal. `type` drives URL/draft state in
 * FilterContext; `control` picks the visual treatment in LeadFilterModal.
 */
export const createLeadFilterConfig = (props: any): FilterConfig => ({
    routeName: "lead-contact.index",
    title: "Lead Filters",
    fields: [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search leads by contact name, email, company...",
            span: 24,
        },

        // ── General ──────────────────────────────────────────────
        {
            key: "temperature",
            label: "Temperature",
            type: "multiselect",
            control: "temperature",
            facetKey: "temperature",
            sentence: "temperature",
            section: "General",
            options: props.temperatures || [],
        },
        {
            key: "lifecycle_status_id",
            label: "Status",
            type: "multiselect",
            control: "pills",
            facetKey: "lifecycle_status_id",
            sentence: "status",
            section: "General",
            options:
                props.leadLifecycleStatuses?.map(
                    (status: { id: number; label: string }) => ({
                        value: status.id,
                        label: status.label,
                    }),
                ) || [],
        },
        {
            key: "next_action",
            label: "Next action",
            type: "select",
            control: "segmented",
            sentence: "next action",
            section: "General",
            options: [
                { value: "overdue", label: "Overdue" },
                { value: "today", label: "Today" },
                { value: "week", label: "Next 7 days" },
                { value: "none", label: "None" },
            ],
        },
        {
            key: "lead_type",
            label: "Lead type",
            type: "select",
            control: "segmented",
            sentence: "lead type",
            section: "General",
            options: [
                { value: "lead", label: "Lead" },
                { value: "client", label: "Client" },
            ],
        },
        {
            key: "start_date",
            label: props.filterV2 ? "Created" : "Created from",
            type: "date",
            control: "datePresets",
            sentence: "created",
            section: "General",
        },
        // Backend needs both start_date and end_date. In v2 the date-range
        // control writes both, so this stays hidden; on the legacy form it has
        // to render as its own picker or the range can never be completed.
        {
            key: "end_date",
            label: "Created to",
            type: "date",
            section: "General",
            hidden: Boolean(props.filterV2),
        },

        // ── Assignment & source ──────────────────────────────────
        {
            key: "lead_source",
            label: "Source",
            type: "multiselect",
            control: "pills",
            facetKey: "lead_source",
            sentence: "source",
            section: "Assignment & Source",
            options:
                props.sources?.map((source: any) => ({
                    value: source.id,
                    label: source.type,
                })) || [],
        },
        {
            key: "category_id",
            label: "Categories",
            type: "multiselect",
            control: "pills",
            facetKey: "category_id",
            sentence: "category",
            section: "Assignment & Source",
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "lead_owner_id",
            label: "Lead owner",
            type: "multiselect",
            control: "checklist",
            facetKey: "lead_owner_id",
            sentence: "owner",
            section: "Assignment & Source",
            placeholder: "Search agents…",
            options:
                props.employees?.map((employee: any) => ({
                    value: employee.id,
                    label: employee.name,
                })) || [],
        },
        {
            key: "referred_by_agent_id",
            label: "Referrer",
            type: "multiselect",
            control: "checklist",
            facetKey: "referred_by_agent_id",
            sentence: "referrer",
            section: "Assignment & Source",
            placeholder: "Search partners…",
            options:
                props.leadAgents?.map((agent: any) => ({
                    value: agent.id,
                    label: agent.user?.name || agent.name || `#${agent.id}`,
                })) || [],
        },
        {
            key: "added_by_id",
            label: "Added by",
            type: "multiselect",
            control: "checklist",
            facetKey: "added_by_id",
            sentence: "added by",
            section: "Assignment & Source",
            placeholder: "Search people…",
            options:
                props.employees?.map((employee: any) => ({
                    value: employee.id,
                    label: employee.name,
                })) || [],
        },

        // ── Profile ───────────────────────────────────────────────
        {
            key: "gender",
            label: "Gender",
            type: "multiselect",
            control: "pills",
            facetKey: "gender",
            sentence: "gender",
            section: "Profile",
            options: props.genders || [],
        },
        {
            key: "preferred_contact_time",
            label: "Preferred contact time",
            type: "multiselect",
            control: "pills",
            facetKey: "preferred_contact_time",
            sentence: "preferred contact time",
            section: "Profile",
            options: props.preferredContactTimes || [],
        },
        {
            key: "age_range",
            label: "Age range",
            type: "multiselect",
            control: "pills",
            facetKey: "age_range",
            sentence: "age range",
            section: "Profile",
            options: props.ageRanges || [],
        },
        {
            key: "nationality",
            label: "Nationality",
            type: "multiselect",
            control: "tokens",
            sentence: "nationality",
            section: "Profile",
            placeholder: "Type to add nationalities…",
            options:
                props.countries?.map((country: any) => ({
                    value: country.nicename,
                    label: country.nicename,
                })) || [],
        },
        {
            key: "country",
            label: "Country",
            type: "multiselect",
            control: "tokens",
            sentence: "country",
            section: "Profile",
            placeholder: "Type to add countries…",
            options:
                props.countries?.map((country: any) => ({
                    value: country.nicename,
                    label: country.nicename,
                })) || [],
        },
        {
            key: "language",
            label: "Languages",
            type: "multiselect",
            control: "pills",
            sentence: "language",
            section: "Profile",
            options:
                props.languages?.map((language: any) => ({
                    value: language.language_code,
                    label: language.language_name,
                })) || [],
        },

        // ── Engagement ───────────────────────────────────────────
        {
            key: "has_joined_the_facebook_group",
            label: "Joined FB group",
            type: "select",
            control: "segmented",
            sentence: "joined FB group",
            section: "Engagement",
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_joined_the_whatsapp_group",
            label: "Joined WhatsApp group",
            type: "select",
            control: "segmented",
            sentence: "joined WhatsApp group",
            section: "Engagement",
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_registered_for_the_webinar",
            label: "Registered for webinar",
            type: "select",
            control: "segmented",
            sentence: "registered for webinar",
            section: "Engagement",
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_attended_the_webinar",
            label: "Attended webinar",
            type: "select",
            control: "segmented",
            sentence: "attended webinar",
            section: "Engagement",
            options: YES_NO_OPTIONS,
        },
        {
            key: "contact_score",
            label: "Contact score",
            type: "numberrange",
            control: "scoreRange",
            sentence: "contact score",
            section: "Engagement",
        },

        // ── Campaign attribution (UTM) ───────────────────────────
        // Values come from what is actually recorded in lead_marketing.
        {
            key: "utm_source",
            label: "UTM Source",
            type: "multiselect",
            control: "utm",
            sentence: "utm_source",
            section: "Campaign (UTM)",
            options: props.utmSources || [],
        },
        {
            key: "utm_medium",
            label: "UTM Medium",
            type: "multiselect",
            control: "utm",
            sentence: "utm_medium",
            section: "Campaign (UTM)",
            options: props.utmMediums || [],
        },
        {
            key: "utm_campaign",
            label: "UTM Campaign",
            type: "multiselect",
            control: "utm",
            sentence: "utm_campaign",
            section: "Campaign (UTM)",
            options: props.utmCampaigns || [],
        },
        {
            key: "utm_content",
            label: "UTM Content",
            type: "multiselect",
            control: "utm",
            sentence: "utm_content",
            section: "Campaign (UTM)",
            options: props.utmContents || [],
        },
        {
            key: "utm_term",
            label: "UTM Term",
            type: "multiselect",
            control: "utm",
            sentence: "utm_term",
            section: "Campaign (UTM)",
            options: props.utmTerms || [],
        },
        {
            key: "utm_audience",
            label: "UTM Audience",
            type: "multiselect",
            control: "utm",
            sentence: "utm_audience",
            section: "Campaign (UTM)",
            options: props.utmAudiences || [],
        },

        // ── Custom fields (option-valued only) ───────────────────
        ...buildLeadCustomFieldFilterFields(props.customFields || []),

        // ── Qualification ─────────────────────────────────────────
        {
            key: "qualification_segment_key",
            label: "Qualification segment",
            type: "text",
            sentence: "qualification segment",
            section: "Qualification",
            placeholder: "Segment key (e.g. budget_question)",
        },
        {
            key: "qualification_answer_values",
            label: "Qualification answers",
            type: "text",
            sentence: "qualification answer",
            section: "Qualification",
            placeholder: "Comma-separated answer values",
        },
    ],
    excludeFields: props.excludeFields,
    defaultValues: {},
});

export default createLeadFilterConfig;
