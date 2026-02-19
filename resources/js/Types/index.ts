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

// ================================================================
// Property Enums/Types
// ================================================================

// Primary Category
export type PrimaryCategory =
    | "residential"
    | "commercial"
    | "land"
    | "construction_project";

// Unit Style (Subtype) — multi-select
export type UnitStyle =
    | "penthouse"
    | "loft"
    | "garden_apartment"
    | "duplex"
    | "triplex"
    | "studio";

// Construction Status
export type ConstructionStatus =
    | "off_plan"
    | "under_construction"
    | "completed_new"
    | "resale"
    | "ruin_renovation";

// View Types (multi-select)
export type ViewType =
    | "sea_front"
    | "sea_view"
    | "mountain_view"
    | "pool_view"
    | "garden_view"
    | "city_view";

// Occupancy Types
export type OccupancyType = "owner_occupied" | "tenant" | "vacant";

// Cities (TRNC)
export type City =
    | "nicosia"
    | "kyrenia"
    | "famagusta"
    | "guzelyurt"
    | "iskele"
    | "lefke";

// Enhanced Deed Types
export type DeedType =
    | "turkish_british"
    | "exchange"
    | "trnc_allocation"
    | "leasehold"
    | "mujahit";

// Deed Status
export type DeedStatus =
    | "owner_individual"
    | "owner_shared"
    | "developer_ready"
    | "no_deed";

// Land Types
export type LandType =
    | "residential_zoned"
    | "field"
    | "residential_commercial"
    | "commercial_zoned"
    | "industrial_zoned"
    | "touristic"
    | "olive_grove";

// ================================================================
// JSON Field Interfaces
// ================================================================

export interface OwnerInfo {
    full_name?: string;
    telephone?: string;
    email?: string;
    key_holder_name?: string;
    key_holder_phone?: string;
    /** Land-only fields */
    agent_responsible?: string;
    allow_101evler_publish?: boolean;
    allow_hangiev_publish?: boolean;
}

export interface LegalInfo {
    military_distance?: string;
    has_restrictions?: boolean;
    restriction_notes?: string;
    deed_status?: DeedStatus;
    vat_paid?: boolean;
    vat_amount?: number;
    trafo_paid?: boolean;
    stopaj_paid?: boolean;
    /** Land-only fields */
    development_rate?: number;
    max_floor_permission?: number;
    has_payment_plan?: boolean;
    downpayment_value?: number;
    downpayment_is_percentage?: boolean;
    payment_period_months?: number;
    interest_rate?: number;
    payment_plan_notes?: string;
}

export interface FinancialInfo {
    owner_price?: number;
    owner_price_currency?: string;
    hibarr_price?: number;
    hibarr_price_currency?: string;
    commission_signed?: boolean;
}

export interface DocumentsChecklist {
    onboarding_contract_url?: string;
    search_document_url?: string;
    sales_agreement_url?: string;
    title_deed_copy_url?: string;
    owner_passport_url?: string;
    site_plan_url?: string;
}

export interface Distances {
    sea_km?: number;
    hospital_km?: number;
    market_km?: number;
    schools_km?: number;
    airport_km?: number;
    beach_km?: number;
}

export interface LandDetails {
    land_type?: LandType;
    price_per_donum?: number;
    price_per_donum_currency?: string;
    total_donums?: number;
    development_rate_percent?: number;
    max_floor_permission?: number;
    location_features?: string[];
}

// ================================================================
// Property Interface
// ================================================================

// Property Types
export interface Property {
    id: number;
    product_id: number;
    developer_project_id?: number | null;
    developer_project_unit_type_id?: number | null;
    project_location_id?: number | null;
    added_by?: number | null;
    responsible_agent_id?: number | null;
    property_type: PropertyType;
    primary_category?: PrimaryCategory;
    unit_style?: UnitStyle[];
    construction_status?: ConstructionStatus;
    sale_type: "sale" | "rent";
    price: number;
    dues?: number;
    minimal_rental_period?: number;
    rent_payment_interval?: string;
    title_deed?: TitleDeedType;
    title_deed_type?: TitleDeedType;
    title_deed_stage?: TitleDeedStage;
    furniture_status?: FurnitureStatus;
    current_occupancy?: OccupancyType;
    open_to_trade: boolean;
    open_to_swap?: boolean;
    swap_notes?: string;
    status: PropertyStatus;
    is_published?: boolean;
    published_at?: string;
    city: string;
    area: string;
    block_name?: string;
    unit_number?: string;
    rooms?: number;
    bedrooms?: number;
    bathrooms?: number;
    floor_number?: number;
    floors_in_building?: number;
    building_age?: number;
    completion_date?: string;
    is_furnished: boolean;
    within_site: boolean;
    associated_construction_company?: string | null;
    associated_construction_company_project?: string | null;
    view_types?: ViewType[];
    distances?: Distances;
    exterior_features?: string[];
    interior_features?: string[];
    location_features?: string[];
    outside_features?: string[];
    inside_features?: string[];
    title: string;
    description?: string;
    video_url?: string;
    tour_360_url?: string;
    map?: any;
    land_size?: number;
    land_size_donum?: number;
    living_area_sqm?: number;
    terrace_area_sqm?: number;
    living_room?: number;
    photos?: string[];
    add_ons?: any;
    owner_info?: OwnerInfo;
    legal_info?: LegalInfo;
    financial_info?: FinancialInfo;
    documents_checklist?: DocumentsChecklist;
    allow_101evler?: boolean;
    allow_hangiev?: boolean;
    land_details?: LandDetails;
    created_at: string;
    updated_at: string;
    product?: Product;
    assets?: PropertyAsset[];
    // Relations
    developerProject?: DeveloperProject;
    projectLocation?: ProjectLocation;
    addedBy?: User;
    responsibleAgent?: User;
    developer_project?: { id: number; name: string } | null;
    // Computed attributes from backend
    reference_code: string;
    display_title: string;
    effective_location: {
        city: string | null;
        area: string | null;
    };
    has_project_location: boolean;

    // ── Unit Type source discriminator fields ──
    // Present when the row originates from a DeveloperProjectUnitType
    _source?: "property" | "unit_type";
    _unit_type_id?: number;
    _developer_project_id?: number;
    _developer_project_name?: string;
    _sold_count?: number;
    _sold_property_ids?: number[];
}

// Project Location (simplified reference)
export interface ProjectLocation {
    id: number;
    name: string;
    description?: string;
    address?: {
        street?: string;
        state?: string;
        country?: string;
        postalCode?: string;
    };
    map_url?: string;
}

// User (simplified reference)
export interface User {
    id: number;
    name: string;
    email: string;
    image_url: string | undefined;
}

export type PropertyType =
    | "Villa"
    | "Twin Villa"
    | "Semi-Detached Villa"
    | "Apartment"
    | "Family Home"
    | "Townhouse"
    | "Loft"
    | "Penthouse"
    | "Bungalow"
    | "Commercial Property"
    | "Block of apartments"
    | "Complete Building"
    | "Abandoned Building"
    | "Ruin"
    | "Residence"
    | "Half Construction"
    | "Time Share"
    | "Residentially Zoned Land"
    | "Field"
    | "Residentially and Commercially Zoned Land"
    | "Commercially Zoned Land"
    | "Industrially Zoned land"
    | "Tourism Zoned Land"
    | "Olive Grove"
    | "Shop"
    | "Hotel"
    | "Workplace"
    | "Warehouse"
    | "Workplace for sale"
    | "Office";

export type PropertyStatus =
    | "Available"
    | "Reserved"
    | "Under offer"
    | "Sold"
    | "Rented"
    | "Withdrawn";

export type TitleDeedType =
    | "Exchange Title Deed"
    | "Turkish Title Deed"
    | "British Title Deed"
    | "Tahsis Title Deed"
    | "Mujahit Title Deed";

export type TitleDeedStage =
    | "Land Title Deed"
    | "Shared Holder Title Deed"
    | "Individual Title Deed"
    | "Individiual (Kat Irtirfakli) Title Deed";

export type FurnitureStatus =
    | "Unfurnished"
    | "Fully Furnished"
    | "Part Furnished"
    | "White Goods Only";

// ================================================================
// Property Enum Values Interface (from backend)
// ================================================================

/** A single lookup value from the database */
export interface LookupValue {
    name: string;
    label: string;
}

export interface PropertyEnumValues {
    primary_categories: LookupValue[];
    unit_styles: LookupValue[];
    construction_statuses: LookupValue[];
    view_types: LookupValue[];
    occupancy_types: LookupValue[];
    cities: LookupValue[];
    areas: LookupValue[];
    deed_types: LookupValue[];
    deed_statuses: LookupValue[];
    land_types: LookupValue[];
    outside_features: LookupValue[];
    inside_features: LookupValue[];
    property_types: LookupValue[];
    floor_types: LookupValue[];
    furniture_statuses: LookupValue[];
    sale_types: LookupValue[];
    statuses: LookupValue[];
    heating_types: LookupValue[];
    location_features: LookupValue[];
    add_ons: LookupValue[];
    type_codes: Record<string, string>;
    subtype_codes: Record<string, string>;
    property_types_by_category: Record<string, LookupValue[]>;
    areas_by_city: Record<string, LookupValue[]>;
}

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
    block_name?: string;
    unit_number?: string;
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
export type AssetType = "image" | "video" | "video_url" | "tour_360_url";

export type AssetTag =
    | "hero"
    | "facilities"
    | "features"
    | "area"
    | "exterior"
    | "interior"
    | "floor-plan"
    | "site-plan"
    | "footer"
    | "gallery";

export interface AssetTagOption {
    value: AssetTag;
    label: string;
}

export interface AssetTypeOption {
    value: AssetType;
    label: string;
}

export interface PropertyAssetOptions {
    tags: AssetTagOption[];
    types: AssetTypeOption[];
}

export interface PropertyAsset {
    id: number;
    property_id: number;
    company_id: number;
    name: string;
    asset_type: AssetType;
    file_path?: string;
    external_url?: string;
    mime_type?: string;
    file_size?: number;
    tags?: AssetTag[];
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
    asset_type?: AssetType | "";
    tags?: AssetTag[];
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
    image_url: string | undefined;
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
    /** Config for default/aggregate display (what is shown and how). */
    display_config?: DisplayConfig | null;
}

/** Item schema for repeatable custom fields. Stored in values when type=repeatable. */
export type RepeatableSchemaType =
    | "text"
    | "number"
    | "password"
    | "textarea"
    | "select"
    | "radio"
    | "date"
    | "checkbox"
    | "country"
    | "currency"
    | "phone"
    | "file";

export interface RepeatableItemSchema {
    key: string;
    type: RepeatableSchemaType;
    label: string;
}

/**
 * Config for default/aggregate display of custom field value (e.g. repeatable).
 * When useDefaultDisplay is true, the stored data is aggregated by fieldKey using aggregateBy
 * and that result is shown instead of the full list.
 */
export interface DisplayConfig {
    /** When true, show aggregated value based on schema instead of full list */
    useDefaultDisplay?: boolean;
    /** Schema key to aggregate (e.g. "price", "name"). Required when useDefaultDisplay is true. */
    fieldKey?: string;
    /** How to aggregate: first, last, concat, sum, sum_currency, count, list */
    aggregateBy?:
        | "first"
        | "last"
        | "concat"
        | "sum"
        | "sum_currency"
        | "count"
        | "list";
    /** Separator for concat/list (default ", ") */
    separator?: string;
    /** Optional display template e.g. "Total: {value}" */
    format?: string;
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

// ================================================================
// Property Availability Request
// ================================================================

export interface PropertyAvailabilityRequest {
    id: number;
    property_id: number;
    requesting_agent_id: number;
    responsible_agent_id?: number;
    status: "pending" | "approved" | "denied" | "escalated" | "expired";
    message: string | null;
    response_message: string | null;
    responded_at: string | null;
    escalated_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
    property?: Pick<
        Property,
        | "id"
        | "title"
        | "reference_code"
        | "city"
        | "area"
        | "status"
        | "property_type"
        | "sale_type"
    >;
    requesting_agent?: User;
    responsible_agent?: User;
}
