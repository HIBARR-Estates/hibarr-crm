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
            section: "Search & General",
            span: 24,
        },
        {
            key: "lead_type",
            label: "Lead Type",
            type: "select",
            placeholder: "Select lead type",
            section: "Search & General",
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
            section: "Search & General",
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
            section: "Categorization",
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
            section: "Assignment & Ownership",
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
            section: "Assignment & Ownership",
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
            section: "Date Range",
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
            section: "Location",
            span: 12,
            options:
                props.countries?.map((country: any) => ({
                    value: country.id,
                    label: country.nicename,
                })) || [],
        },
        {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "Select status",
            section: "Status & Priority",
            span: 12,
            options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "converted", label: "Converted" },
                { value: "lost", label: "Lost" },
            ],
        },
        {
            key: "client_category_id",
            label: "Client Category",
            type: "select",
            placeholder: "Select client category",
            section: "Advanced",
            span: 12,
            options:
                props.clientCategories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "language_id",
            label: "Language",
            type: "select",
            placeholder: "Select language",
            section: "Advanced",
            span: 12,
            options:
                props.languages?.map((language: any) => ({
                    value: language.id,
                    label: language.language_name,
                })) || [],
        },
    ],
    defaultValues: {},
});

export default createLeadFilterConfig;
