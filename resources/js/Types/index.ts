import { ErrorBag, Errors, PageProps } from "@inertiajs/core";
import { AppModule, AppPermission } from "./permission";

// Laravel Pagination Interface
export interface Pagination<T> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: PaginationLink[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

// Import DeveloperProject types
import { DeveloperProject } from "./developerProject";

// Property Types
export interface Property {
    id: number;
    product_id: number;
    developer_project_id?: number | null;
    property_type: PropertyType;
    sale_type: "sale" | "rent";
    price: number;
    dues?: number;
    minimal_rental_period?: number;
    rent_payment_interval?: string;
    title_deed?: TitleDeedType;
    title_deed_type?: TitleDeedType;
    title_deed_stage?: TitleDeedStage;
    furniture_status?: FurnitureStatus;
    open_to_trade: boolean;
    status: PropertyStatus;
    city: string;
    area: string;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor_number?: number;
    floors_in_building?: number;
    building_age?: number;
    is_furnished: boolean;
    within_site: boolean;
    exterior_features?: string[];
    interior_features?: string[];
    location_features?: string[];
    title: string;
    description?: string;
    video_url?: string;
    tour_360_url?: string;
    map?: any;
    land_size?: number;
    living_room?: number;
    photos?: string[];
    add_ons?: any;
    created_at: string;
    updated_at: string;
    product?: Product;
    assets?: PropertyAsset[];
    // Relations
    developerProject?: DeveloperProject;
    // Computed attributes from backend
    effective_location: {
        city: string | null;
        area: string | null;
    };
    has_project_location: boolean;
}

export type PropertyType =
    | "apartment"
    | "villa"
    | "house"
    | "office"
    | "shop"
    | "warehouse"
    | "residential_land"
    | "commercial_land";

export type PropertyStatus =
    | "available"
    | "under_offer"
    | "sold"
    | "rented"
    | "withdrawn";

export type TitleDeedType = "green" | "blue" | "pink" | "white";

export type TitleDeedStage = "ready" | "in_progress" | "not_available";

export type FurnitureStatus = "furnished" | "semi_furnished" | "unfurnished";

// Product Interface
export interface Product {
    id: number;
    name: string;
    status: string;
    added_by: number;
    assigned_to?: number;
    created_at: string;
    updated_at: string;
}

// Form Data Types
export interface PropertyFormData {
    product_id: string;
    property_type: PropertyType | "";
    sale_type: "sale" | "rent" | "";
    price: string;
    dues?: string;
    minimal_rental_period?: string;
    rent_payment_interval?: string;
    title_deed?: TitleDeedStage | "";
    title_deed_type?: TitleDeedType | "";
    title_deed_stage?: TitleDeedStage | "";
    furniture_status?: FurnitureStatus | "";
    open_to_trade: boolean;
    status: PropertyStatus;
    city: string;
    area: string;
    rooms?: string;
    bedrooms?: string;
    bathrooms?: string;
    floor_number?: string;
    floors_in_building?: string;
    building_age?: string;
    is_furnished: boolean;
    within_site: boolean;
    exterior_features: string[];
    interior_features: string[];
    location_features: string[];
    title: string;
    description?: string;
    video_url?: string;
    tour_360_url?: string;
    map?: any;
    land_size?: string;
    living_room?: string;
    photos?: string[];
    add_ons?: any;
}

// Filter Types
export interface PropertyFilters {
    search?: string;
    property_type?: PropertyType | "";
    sale_type?: "sale" | "rent" | "";
    status?: PropertyStatus | "";
    city?: string;
    min_price?: string;
    max_price?: string;
}

// Page Props
export interface PropertyIndexProps extends PageProps {
    props: {
        properties: Pagination<Property>;
        products: Product[];
        filters: PropertyFilters;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyCreateProps extends PageProps {
    props: {
        products: Product[];
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyEditProps extends PageProps {
    props: {
        property: Property;
        products: Product[];
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyShowProps extends PageProps {
    props: {
        property: Property;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

// Property Asset Types
export interface PropertyAsset {
    id: number;
    property_id: number;
    company_id: number;
    name: string;
    asset_type: "image" | "video" | "video_url" | "tour_360_url";
    file_path?: string;
    external_url?: string;
    mime_type?: string;
    file_size?: number;
    tags?: string[];
    metadata?: Record<string, any>;
    order: number;
    url?: string;
    formatted_size?: string;
    has_tags: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
    property?: Property;
}

export interface PropertyAssetFilters {
    asset_type?: "image" | "video" | "video_url" | "tour_360_url" | "";
    tags?: string[];
    search?: string;
    sort_by?: "created_at" | "name" | "size";
    sort_order?: "asc" | "desc";
}

export interface PropertyAssetManageProps extends PageProps {
    props: {
        property: Property;
        assets: Pagination<PropertyAsset>;
        availableTags: Record<string, string>;
        availableTypes: Record<string, string>;
        filters: PropertyAssetFilters;
        errors: Errors & ErrorBag;
    };
}

// Common Types

export interface Role {
    id: number;
    name: string;
    display_name: string;
    description?: string;
}

export interface User {
    id: number;
    company_id: number;
    name: string;
    email: string;
    image_url: string;
    employee_detail?: {
        designation?: {
            name: string;
        };
    };
    modules?: string[];
    mobile_with_phone_code?: string;
    name_salutation?: string;
    phone_number?: string;
    country_code?: string | null;
    session?: null;
    client_contact?: null;
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
    //

    dark_theme: boolean;
    designation: string;
    roles: Role[];
}
export interface FlashMessage {
    type: "success" | "error" | "info" | "warning";
    message: string;
}
export interface AuthType {
    user: User;
    permissions: AppPermission;
    modules: AppModule[];
}
export interface AppProps extends PageProps {
    props: {
        auth: AuthType;
        flash?: FlashMessage;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

// Lead Types
export { type Lead } from "./api/leads";
// Deal Types
export { type Deal } from "./api/deals";

// Client Types
export interface Country {
    id: number;
    iso: string;
    name: string;
    nicename: string;
    iso3: string;
    numcode: number;
    phonecode: number;
}

export interface ClientCategory {
    id: number;
    category_name: string;
    created_at: string;
    updated_at: string;
}

export interface Salutation {
    value: string;
    label: string;
}

export interface Language {
    id: number;
    language_name: string;
    language_code: string;
    status: string;
    flag: string | null;
}

export interface CustomField {
    id: number;
    label: string;
    name: string;
    type: string;
    required: string;
    values: string | null;
    custom_field_group_id: number;
    show_table: string;
    field_display_name: string;
    field_order: number;
    display_order?: number;
    show_rule_set?: ShowRuleSet;
    /** For type=repeatable: the field whose value (N) dictates how many blocks to render. */
    linked_field_id?: number | null;
}

/** Item schema for repeatable custom fields. Stored in values when type=repeatable. */
export type RepeatableSchemaType =
    | 'text'
    | 'number'
    | 'password'
    | 'textarea'
    | 'select'
    | 'radio'
    | 'date'
    | 'checkbox'
    | 'country'
    | 'currency'
    | 'phone'
    | 'file';

export interface RepeatableItemSchema {
    key: string;
    type: RepeatableSchemaType;
    label: string;
}

// New interfaces for visibility rules
export interface ShowRuleSet {
    id: number;
    field_id: number;
    default_visibility: boolean;
    enabled: boolean;
    groups_operator?: "AND" | "OR"; // How to combine multiple groups
    group?: ShowRuleGroup; // For backward compatibility (single group)
    groups?: ShowRuleGroup[]; // Multiple groups support
}

export interface ShowRuleGroup {
    id: number;
    rule_set_id: number;
    group_operator: "AND" | "OR";
    enabled?: boolean; // Whether this group is enabled
    visibility_action?: "show" | "hide"; // Whether this group shows or hides the field when it matches
    criteria?: ShowCriterion[];
}

export interface ShowCriterion {
    id: number;
    group_id: number;
    reference_field_id: number;
    operator:
        | "equals"
        | "exists"
        | "boolean"
        | ">"
        | "<"
        | ">="
        | "<="
        | "in"
        | "not_in";
    reference_value: string;
    negate: boolean;
    reference_field?: CustomField; // Populated from backend
}
