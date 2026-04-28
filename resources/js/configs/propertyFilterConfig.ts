import { FilterConfig } from "@/contexts/FilterContext";
import type { DeveloperProjectOption } from "@/Types/developerProject";

interface CityOption {
    name: string;
    label: string;
}

interface PropertyFilterProps {
    developerProjects?: DeveloperProjectOption[];
    cities?: CityOption[];
    excludeFields?: string[];
}

export const createPropertyFilterConfig = (
    props: PropertyFilterProps,
): FilterConfig => ({
    routeName: "properties.index",
    title: "Property Filters",
    fields: [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search properties by title, area, description ...",
            span: 24,
        },
        {
            key: "publishing_status",
            label: "Publishing Status",
            type: "select",
            placeholder: "Select publishing status",
            span: 12,
            options: [
                { value: "all", label: "All" },
                { value: "published", label: "Published" },
                { value: "draft", label: "My Drafts" },
            ],
        },
        {
            key: "developer_project_id",
            label: "Developer Project",
            type: "select",
            placeholder: "Select developer project",
            span: 12,
            options: [
                { value: "", label: "All Projects" },
                ...(props.developerProjects?.map((project) => ({
                    value: String(project.id),
                    label:
                        project.name +
                        (project.location ? ` (${project.location.name})` : ""),
                })) || []),
            ],
        },
        {
            key: "property_type",
            label: "Property Type",
            type: "select",
            placeholder: "Select property type",
            span: 12,
            options: [
                { value: "apartment", label: "Apartment" },
                { value: "villa", label: "Villa" },
                { value: "townhouse", label: "Townhouse" },
                { value: "penthouse", label: "Penthouse" },
                { value: "studio", label: "Studio" },
                { value: "commercial", label: "Commercial" },
                { value: "land", label: "Land" },
            ],
        },
        {
            key: "sale_type",
            label: "Sale Type",
            type: "select",
            placeholder: "Select sale type",
            span: 12,
            options: [
                { value: "for_sale", label: "For Sale" },
                { value: "for_rent", label: "For Rent" },
                { value: "daily_rental", label: "Daily Rental" },
            ],
        },
        {
            key: "status",
            label: "Status",
            type: "select",
            placeholder: "Select status",
            span: 12,
            options: [
                { value: "available", label: "Available" },
                { value: "sold", label: "Sold" },
                { value: "rented", label: "Rented" },
                { value: "off_market", label: "Off Market" },
                { value: "under_construction", label: "Under Construction" },
            ],
        },
        {
            key: "city",
            label: "City / Location",
            type: "select",
            placeholder: "Select city",
            span: 12,
            options: [
                { value: "", label: "All Cities" },
                ...(props.cities?.map((c) => ({ value: c.name, label: c.label })) ?? []),
            ],
        },
        {
            key: "project_location",
            label: "Project Location Only",
            type: "text",
            placeholder: "Filter by project location name",
            span: 12,
        },
        {
            key: "price_range",
            label: "Price Range",
            type: "numberrange",
            span: 24,
            formatDisplayValue: (value: any) => {
                if (Array.isArray(value)) {
                    return `$${value[0]?.toLocaleString()} - $${value[1]?.toLocaleString()}`;
                }
                return `$${value?.toLocaleString()}`;
            },
        },
        {
            key: "bedrooms",
            label: "Bedrooms",
            type: "select",
            placeholder: "Select bedrooms",
            span: 12,
            options: [
                { value: "studio", label: "Studio" },
                { value: "1", label: "1 Bedroom" },
                { value: "2", label: "2 Bedrooms" },
                { value: "3", label: "3 Bedrooms" },
                { value: "4", label: "4 Bedrooms" },
                { value: "5+", label: "5+ Bedrooms" },
            ],
        },
        {
            key: "bathrooms",
            label: "Bathrooms",
            type: "select",
            placeholder: "Select bathrooms",
            span: 12,
            options: [
                { value: "1", label: "1 Bathroom" },
                { value: "2", label: "2 Bathrooms" },
                { value: "3", label: "3 Bathrooms" },
                { value: "4", label: "4 Bathrooms" },
                { value: "5+", label: "5+ Bathrooms" },
            ],
        },
        {
            key: "created_date",
            label: "Created Date Range",
            type: "daterange",
            span: 24,
        },
    ],
    excludeFields: props.excludeFields,
    defaultValues: {},
});

export default createPropertyFilterConfig;
