/**
 * Types for Property Configuration / Lookup Tables management.
 */

import { DefaultDistances } from ".";

/** A single item from any of the 9 property lookup tables. */
export interface PropertyConfigItem {
    id: number;
    company_id: number | null;
    name: string;
    label: string;
    description: string | null;
    /** Only present for sub-types */
    parent_type?: string;
    /** Only present for areas */
    city_id?: number;
    /** Only present for property-types — the primary category this type belongs to */
    category?: string;
    /** Only present for project-facilities — Lucide icon identifier */
    icon?: string | null;
    /** Only present for airports */
    code?: string | null;
    /** Only present for cities — image URL */
    image_url?: string | null;
    created_at: string;
    updated_at: string;
}

/** Payload for creating / updating a config item. */
export interface PropertyConfigPayload {
    /** Machine key — sent on create (auto-generated from label), omitted on update (immutable). */
    name?: string;
    label: string;
    description?: string | null;
    parent_type?: string;
    city_id?: number;
    category?: string;
    default_distances?: DefaultDistances;
    icon?: string | null;
    code?: string | null;
    image_url?: string | null;
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
    | "deed-statuses"
    | "construction-statuses"
    | "occupancy-types"
    | "furniture-statuses"
    | "heating-types"
    | "cities"
    | "areas"
    | "sale-types"
    | "statuses"
    | "location-features"
    | "add-ons"
    | "project-facilities"
    | "airports"
    | "infrastructures";

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
        description:
            "Primary listing categories (Residential, Commercial, Land)",
        icon: "TagOutlined",
    },
    "view-types": {
        label: "View Types",
        description: "Property view options (Sea View, Mountain View, etc.)",
        icon: "EyeOutlined",
    },
    "title-deed-types": {
        label: "Title Deed Types",
        description: "Types of title deeds (Turkish/British, Exchange, etc.)",
        icon: "FileProtectOutlined",
    },
    "exterior-features": {
        label: "Exterior Features",
        description: "Exterior amenities (Pool, Garden, Parking, etc.)",
        icon: "BuildOutlined",
    },
    "interior-features": {
        label: "Interior Features",
        description:
            "Interior amenities (AC, Fireplace, Built-in Kitchen, etc.)",
        icon: "AppstoreOutlined",
    },
    "floor-types": {
        label: "Floor Types",
        description: "Floor levels (Ground Floor, Floor 1–15, etc.)",
        icon: "BorderBottomOutlined",
    },
    "deed-statuses": {
        label: "Deed Statuses",
        description:
            "Status of property deeds (Owner Individual, No Deed, etc.)",
        icon: "CheckCircleOutlined",
    },
    "construction-statuses": {
        label: "Construction Statuses",
        description:
            "Construction stage (Off-Plan, Under Construction, Resale, etc.)",
        icon: "ToolOutlined",
    },
    "occupancy-types": {
        label: "Occupancy Types",
        description: "Current occupancy (Owner Occupied, Tenant, Vacant)",
        icon: "UserOutlined",
    },
    "furniture-statuses": {
        label: "Furniture Statuses",
        description: "Furnishing level (Unfurnished, Fully Furnished, etc.)",
        icon: "ShopOutlined",
    },
    "heating-types": {
        label: "Heating Types",
        description: "Heating system (Central, Underfloor, AC, Solar, etc.)",
        icon: "FireOutlined",
    },
    cities: {
        label: "Cities",
        description: "TRNC cities (Kyrenia, Gazimağusa, Nicosia, etc.)",
        icon: "EnvironmentOutlined",
    },
    areas: {
        label: "Areas",
        description:
            "Districts/areas within each city (Alsancak, Çatalköy, etc.)",
        icon: "CompassOutlined",
    },
    "sale-types": {
        label: "Sale Types",
        description: "Listing purpose (For Sale, For Rent, For Daily Rental)",
        icon: "ShoppingOutlined",
    },
    statuses: {
        label: "Property Statuses",
        description: "Listing status (Available, Reserved, Sold, etc.)",
        icon: "FlagOutlined",
    },
    "location-features": {
        label: "Location Features",
        description: "Proximity features (Near Beach, Near School, etc.)",
        icon: "CompassOutlined",
    },
    "add-ons": {
        label: "Add-Ons",
        description:
            "Optional extras (Furniture Package, Rental Guarantee, etc.)",
        icon: "PlusCircleOutlined",
    },
    "project-facilities": {
        label: "Project Facilities",
        description:
            "Facilities available in developer projects (Gym, Pool, etc.)",
        icon: "AppstoreOutlined",
    },
    airports: {
        label: "Airports",
        description: "Managed airport list used in project locations",
        icon: "RocketOutlined",
    },
    infrastructures: {
        label: "Infrastructure",
        description: "Managed infrastructure list used in project locations",
        icon: "CarOutlined",
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
    "construction-statuses",
    "occupancy-types",
    "furniture-statuses",
    "heating-types",
    "cities",
    "areas",
    "sale-types",
    "statuses",
    "location-features",
    "add-ons",
    "project-facilities",
    "airports",
    "infrastructures",
];
