import { FilterConfig } from "@/contexts/FilterContext";

export const createPropertyAssetFilterConfig = (
    availableTags: Record<string, string>,
    availableTypes: Record<string, string>
): FilterConfig => {
    // Convert tags object to options array
    const tagOptions = Object.entries(availableTags).map(([value, label]) => ({
        value,
        label,
    }));

    // Convert types object to options array
    const typeOptions = Object.entries(availableTypes).map(
        ([value, label]) => ({
            value,
            label,
        })
    );

    return {
        routeName: "properties.assets.index",
        title: "Asset Filters",
        fields: [
            {
                key: "search",
                label: "Search",
                type: "text",
                placeholder: "Search assets by name...",
                span: 24,
            },
            {
                key: "asset_type",
                label: "Asset Type",
                type: "select",
                placeholder: "All types",
                span: 12,
                options: typeOptions,
            },
            {
                key: "tags",
                label: "Tags",
                type: "multiselect",
                placeholder: "Select tags",
                span: 12,
                options: tagOptions,
            },
            {
                key: "sort_by",
                label: "Sort By",
                type: "select",
                placeholder: "Sort by",
                span: 12,
                options: [
                    { value: "created_at", label: "Date Added" },
                    { value: "name", label: "Name" },
                    { value: "size", label: "File Size" },
                ],
            },
            {
                key: "sort_order",
                label: "Sort Order",
                type: "select",
                placeholder: "Sort order",
                span: 12,
                options: [
                    { value: "desc", label: "Descending" },
                    { value: "asc", label: "Ascending" },
                ],
            },
        ],
    };
};

export default createPropertyAssetFilterConfig;
