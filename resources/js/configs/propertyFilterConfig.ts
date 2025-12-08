import { FilterConfig } from "@/contexts/FilterContext";

export const createPropertyFilterConfig = (props: any): FilterConfig => ({
    routeName: "properties.index",
    title: "Property Filters",
    fields: [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search properties by title, area, description...",
            section: "Search & General",
            span: 24,
        },
        {
            key: "property_type",
            label: "Property Type",
            type: "select",
            placeholder: "Select property type",
            section: "Property Details",
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
            section: "Property Details",
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
            section: "Property Details",
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
            label: "City",
            type: "text",
            placeholder: "Enter city name",
            section: "Location",
            span: 12,
        },
        {
            key: "price_range",
            label: "Price Range",
            type: "numberrange",
            section: "Financial",
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
            section: "Property Features",
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
            section: "Property Features",
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
            section: "Date Range",
            span: 24,
        },
    ],
    defaultValues: {},
});

export default createPropertyFilterConfig;
