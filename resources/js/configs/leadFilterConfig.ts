import { FilterConfig } from "@/contexts/FilterContext";

const YES_NO_OPTIONS = [
    { value: "1", label: "Yes" },
    { value: "0", label: "No" },
];

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
            key: "lead_type",
            label: "Lead Type",
            type: "select",
            section: "General",
            placeholder: "Select lead type",
            span: 8,
            options: [
                { value: "lead", label: "Lead" },
                { value: "client", label: "Client" },
            ],
        },
        {
            key: "lifecycle_status_id",
            label: "Status",
            type: "multiselect",
            section: "General",
            placeholder: "Select statuses",
            span: 8,
            options:
                props.leadLifecycleStatuses?.map(
                    (status: { id: number; label: string }) => ({
                        value: status.id,
                        label: status.label,
                    }),
                ) || [],
        },
        {
            key: "temperature",
            label: "Temperature",
            type: "multiselect",
            section: "General",
            placeholder: "Select temperatures",
            span: 8,
            options:
                props.temperatures?.map(
                    (temperature: { value: string; label: string }) => ({
                        value: temperature.value,
                        label: temperature.label,
                    }),
                ) || [],
        },
        {
            key: "start_date",
            label: "Created Date Range",
            type: "daterange",
            section: "General",
            span: 24,
            formatDisplayValue: (value: any) => {
                if (Array.isArray(value)) {
                    return value.join(" to ");
                }
                return value;
            },
        },

        // ── Assignment & source ──────────────────────────────────
        {
            key: "lead_source",
            label: "Source",
            type: "multiselect",
            section: "Assignment & Source",
            placeholder: "Select sources",
            span: 12,
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
            section: "Assignment & Source",
            placeholder: "Select categories",
            span: 12,
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "lead_owner_id",
            label: "Lead Owner",
            type: "multiselect",
            section: "Assignment & Source",
            placeholder: "Select lead owners",
            span: 12,
            options:
                props.employees?.map((employee: any) => ({
                    value: employee.id,
                    label: employee.name,
                })) || [],
        },
        {
            key: "added_by_id",
            label: "Added By",
            type: "multiselect",
            section: "Assignment & Source",
            placeholder: "Select who added",
            span: 12,
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
            section: "Profile",
            placeholder: "Select genders",
            span: 12,
            options:
                props.genders?.map(
                    (gender: { value: string; label: string }) => ({
                        value: gender.value,
                        label: gender.label,
                    }),
                ) || [],
        },
        {
            key: "age_range",
            label: "Age Range",
            type: "multiselect",
            section: "Profile",
            placeholder: "Select age ranges",
            span: 12,
            options:
                props.ageRanges?.map(
                    (ageRange: { value: string; label: string }) => ({
                        value: ageRange.value,
                        label: ageRange.label,
                    }),
                ) || [],
        },
        {
            key: "nationality",
            label: "Nationality",
            type: "multiselect",
            section: "Profile",
            placeholder: "Select nationalities",
            span: 12,
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
            section: "Profile",
            placeholder: "Select countries",
            span: 12,
            options:
                props.countries?.map((country: any) => ({
                    value: country.nicename,
                    label: country.nicename,
                })) || [],
        },
        ...(props.useLeadCoreFields
            ? [
                  {
                      key: "language",
                      label: "Languages",
                      type: "multiselect" as const,
                      section: "Profile",
                      placeholder: "Select languages",
                      span: 24,
                      options:
                          props.languages?.map((language: any) => ({
                              value: language.language_code,
                              label: language.language_name,
                          })) || [],
                  },
              ]
            : [
                  {
                      key: "language_id",
                      label: "Languages",
                      type: "multiselect" as const,
                      section: "Profile",
                      placeholder: "Select languages",
                      span: 24,
                      options:
                          props.languages?.map((language: any) => ({
                              value: language.id,
                              label: language.language_name,
                          })) || [],
                  },
              ]),

        // ── Marketing engagement ─────────────────────────────────
        {
            key: "has_joined_the_facebook_group",
            label: "Joined FB Group",
            type: "select",
            section: "Marketing Engagement",
            placeholder: "Yes / No",
            span: 8,
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_registered_for_the_webinar",
            label: "Registered for Webinar",
            type: "select",
            section: "Marketing Engagement",
            placeholder: "Yes / No",
            span: 8,
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_attended_the_webinar",
            label: "Attended Webinar",
            type: "select",
            section: "Marketing Engagement",
            placeholder: "Yes / No",
            span: 8,
            options: YES_NO_OPTIONS,
        },
        {
            key: "has_joined_the_whatsapp_group",
            label: "Joined WhatsApp Group",
            type: "select",
            section: "Marketing Engagement",
            placeholder: "Yes / No",
            span: 8,
            options: YES_NO_OPTIONS,
        },
        {
            key: "contact_score",
            label: "Contact Score",
            type: "numberrange",
            section: "Marketing Engagement",
            span: 16,
        },

        // ── Campaign attribution (UTM) ───────────────────────────
        // Options are the distinct UTM values already present in the database
        // (see FormDataService::getDistinctMarketingValues), not free text.
        {
            key: "utm_source",
            label: "UTM Source",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM sources",
            span: 8,
            options: props.utmSources || [],
        },
        {
            key: "utm_medium",
            label: "UTM Medium",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM mediums",
            span: 8,
            options: props.utmMediums || [],
        },
        {
            key: "utm_campaign",
            label: "UTM Campaign",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM campaigns",
            span: 8,
            options: props.utmCampaigns || [],
        },
        {
            key: "utm_content",
            label: "UTM Content",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM content",
            span: 8,
            options: props.utmContents || [],
        },
        {
            key: "utm_term",
            label: "UTM Term",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM terms",
            span: 8,
            options: props.utmTerms || [],
        },
        {
            key: "utm_audience",
            label: "UTM Audience",
            type: "multiselect",
            section: "Campaign Attribution (UTM)",
            placeholder: "Select UTM audiences",
            span: 8,
            options: props.utmAudiences || [],
        },

        // ── Qualification ─────────────────────────────────────────
        {
            key: "qualification_segment_key",
            label: "Qualification Segment",
            type: "text",
            section: "Qualification",
            placeholder: "Segment key (e.g. budget_question)",
            span: 12,
        },
        {
            key: "qualification_answer_values",
            label: "Qualification Answers",
            type: "text",
            section: "Qualification",
            placeholder: "Comma-separated answer values",
            span: 12,
            formatDisplayValue: (value: any) => {
                if (Array.isArray(value)) {
                    return value.join(", ");
                }
                return value;
            },
        },
    ],
    excludeFields: props.excludeFields,
    defaultValues: {},
});

export default createLeadFilterConfig;
