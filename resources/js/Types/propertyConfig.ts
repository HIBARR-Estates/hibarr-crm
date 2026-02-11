/**
 * Types for Property Configuration / Lookup Tables management.
 */

/** A single item from any of the 9 property lookup tables. */
export interface PropertyConfigItem {
    id: number;
    company_id: number;
    name: string;
    label: string;
    description: string | null;
    /** Only present for sub-types */
    parent_type?: string;
    created_at: string;
    updated_at: string;
}

/** Payload for creating / updating a config item. */
export interface PropertyConfigPayload {
    name: string;
    label: string;
    description?: string | null;
    parent_type?: string;
}

/** Summary returned by GET /property-config/types */
export interface ConfigTypeSummary {
    slug: string;
    count: number;
}

/** API response shape for the types endpoint */
export interface ConfigTypesResponse {
    status: string;
    data: ConfigTypeSummary[];
}

/** API response shape for listing items */
export interface ConfigItemsResponse {
    status: string;
    data: PropertyConfigItem[];
    type: string;
}

/** Metadata for each config category */
export interface ConfigCategoryMeta {
    label: string;
    description: string;
    icon: string; // Ant Design icon name
}

/** All available config type slugs */
export type ConfigTypeSlug =
    | "property-types"
    | "sub-types"
    | "primary-categories"
    | "view-types"
    | "title-deed-types"
    | "exterior-features"
    | "interior-features"
    | "floor-types"
    | "deed-statuses";

/** Human-readable labels and descriptions for each config type */
export const CONFIG_CATEGORIES: Record<ConfigTypeSlug, ConfigCategoryMeta> = {
    "property-types": {
        label: "Property Types",
        description: "Types of properties (Apartment, Villa, Land, etc.)",
        icon: "HomeOutlined",
    },
    "sub-types": {
        label: "Sub Types",
        description: "Sub-classifications within property types",
        icon: "ApartmentOutlined",
    },
    "primary-categories": {
        label: "Primary Categories",
        description: "Primary listing categories (Sale, Rent, etc.)",
        icon: "TagOutlined",
    },
    "view-types": {
        label: "View Types",
        description: "Property view options (Sea View, Mountain View, etc.)",
        icon: "EyeOutlined",
    },
    "title-deed-types": {
        label: "Title Deed Types",
        description: "Types of title deeds (Freehold, Leasehold, etc.)",
        icon: "FileProtectOutlined",
    },
    "exterior-features": {
        label: "Exterior Features",
        description: "Exterior amenities (Pool, Garden, Parking, etc.)",
        icon: "BuildOutlined",
    },
    "interior-features": {
        label: "Interior Features",
        description: "Interior amenities (AC, Fireplace, Smart Home, etc.)",
        icon: "AppstoreOutlined",
    },
    "floor-types": {
        label: "Floor Types",
        description: "Floor covering materials (Marble, Tile, Parquet, etc.)",
        icon: "BorderBottomOutlined",
    },
    "deed-statuses": {
        label: "Deed Statuses",
        description: "Status of property deeds (Ready, In Progress, etc.)",
        icon: "CheckCircleOutlined",
    },
};

/** Ordered list of type slugs for consistent rendering */
export const CONFIG_TYPE_ORDER: ConfigTypeSlug[] = [
    "property-types",
    "sub-types",
    "primary-categories",
    "view-types",
    "title-deed-types",
    "exterior-features",
    "interior-features",
    "floor-types",
    "deed-statuses",
];
