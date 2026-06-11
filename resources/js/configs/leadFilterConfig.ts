import { FilterConfig } from "@/contexts/FilterContext";

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
        {
            key: "lead_type",
            label: "Lead Type",
            type: "select",
            placeholder: "Select lead type",
            span: 12,
            options: [
                { value: "lead", label: "Lead" },
                { value: "client", label: "Client" },
            ],
        },
        {
            key: "lead_source",
            label: "Lead Source",
            type: "select",
            placeholder: "Select lead source",
            span: 12,
            options:
                props.sources?.map((source: any) => ({
                    value: source.id,
                    label: source.type,
                })) || [],
        },
        {
            key: "category_id",
            label: "Category",
            type: "select",
            placeholder: "Select category",
            span: 24,
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "lead_owner_id",
            label: "Lead Owner",
            type: "select",
            placeholder: "Select lead owner",
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
            type: "select",
            placeholder: "Select who added",
            span: 12,
            options:
                props.employees?.map((employee: any) => ({
                    value: employee.id,
                    label: employee.name,
                })) || [],
        },
        {
            key: "start_date",
            label: "Created Date Range",
            type: "daterange",
            span: 24,
            formatDisplayValue: (value: any) => {
                if (Array.isArray(value)) {
                    return value.join(" to ");
                }
                return value;
            },
        },
        {
            key: "country_id",
            label: "Country",
            type: "select",
            placeholder: "Select country",
            span: 12,
            options:
                props.countries?.map((country: any) => ({
                    value: country.id,
                    label: country.nicename,
                })) || [],
        },
        {
            key: "lifecycle_status_id",
            label: "Lifecycle Status",
            type: "select",
            placeholder: "Select lifecycle status",
            span: 12,
            options:
                props.leadLifecycleStatuses?.map(
                    (status: { id: number; label: string }) => ({
                        value: status.id,
                        label: status.label,
                    }),
                ) || [],
        },
        {
            key: "qualification_segment_key",
            label: "Qualification Segment",
            type: "text",
            placeholder: "Segment key (e.g. budget_question)",
            span: 12,
        },
        {
            key: "qualification_answer_values",
            label: "Qualification Answers",
            type: "text",
            placeholder: "Comma-separated answer values",
            span: 12,
            formatDisplayValue: (value: any) => {
                if (Array.isArray(value)) {
                    return value.join(", ");
                }
                return value;
            },
        },
        {
            key: "client_category_id",
            label: "Client Category",
            type: "select",
            placeholder: "Select client category",
            span: 12,
            options:
                props.clientCategories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        ...(props.useLeadCoreFields
            ? [
                  {
                      key: "language",
                      label: "Language",
                      type: "select" as const,
                      placeholder: "Select language",
                      span: 12,
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
                      label: "Language",
                      type: "select" as const,
                      placeholder: "Select language",
                      span: 12,
                      options:
                          props.languages?.map((language: any) => ({
                              value: language.id,
                              label: language.language_name,
                          })) || [],
                  },
              ]),
    ],
    excludeFields: props.excludeFields,
    defaultValues: {},
});

export default createLeadFilterConfig;
