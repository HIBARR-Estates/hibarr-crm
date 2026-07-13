/**
 * Developer Project & Expose Configuration Types
 *
 * These types correspond to the backend models and the ExposeProjectConfigData
 * interface used for PDF expose generation.
 */

import type { AssetTag } from "@/Types";

// ============================================
// Developer Project Asset Types
// ============================================

export interface DeveloperProjectAsset {
    id: number;
    developer_project_id: number;
    company_id: number;
    name: string;
    asset_type: "image" | "video" | "video_url";
    file_path?: string | null;
    external_url?: string | null;
    mime_type?: string | null;
    file_size?: number | null;
    tags?: AssetTag[];
    metadata?: Record<string, any>;
    order: number;
    url?: string;
    formatted_size?: string;
    has_tags: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

// ============================================
// Developer Types
// ============================================

export interface Developer {
    id: number;
    company_id: number;
    name: string;
    logo_url: string | null;
    description: string | null;
    project_list: string[] | null;
    whatsapp_group_link: string | null;
    google_drive_link: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Computed
    projects_count?: number;
}

// Minimal version for dropdowns
export interface DeveloperOption {
    id: number;
    name: string;
    logo_url?: string | null;
}

// ============================================
// Project Location Types
// ============================================

export interface LocationAddress {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
}

export interface LocationAttraction {
    name: string;
    content: string[];
    images: {
        primary: string;
        secondary: string;
    };
}

export interface LocationInfrastructure {
    infrastructure_id?: number;
    travelTimeInMin: number;
    // Expanded fields (from API)
    name?: string;
    icon?: string;
    image?: string;
}

export interface LocationAirport {
    airport_id?: number;
    travelTimeInMin: number;
    // Expanded fields (from API)
    name?: string;
    code?: string;
    image?: string;
}

export interface Infrastructure {
    id: number;
    name: string;
    icon: string | null;
}

export interface Airport {
    id: number;
    name: string;
    code: string | null;
}

export interface ProjectLocation {
    id: number;
    company_id: number;
    //
    city?: string;
    area?: string;
    //
    name: string;
    description: string | null;
    address: LocationAddress | null;
    map_url: string | null;
    image_url: string | null;
    attractions: LocationAttraction[];
    infrastructure: LocationInfrastructure[];
    airports: LocationAirport[];
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Computed attributes
    full_address?: string;
    state?: string;
    country?: string;
}

// Minimal version for dropdowns
export interface ProjectLocationOption {
    id: number;
    name: string;
    full_address?: string;
    city?: string;
    state?: string;
}

// ============================================
// Developer Project Types
// ============================================

export interface DeveloperProject {
    id: number;
    company_id: number;
    developer_id: number | null;
    name: string;
    reference_code: string | null;
    description: string | null;
    project_location_id: number | null;
    // Construction project fields
    google_drive_link: string | null;
    availability_link: string | null;
    starting_price: number | null;
    primary_categories: string[] | null;
    title_deed_type: string | null;
    unit_types: string[] | null;
    number_of_units: number | null;
    total_units: number | null;
    total_units_sold: number | null;
    number_of_blocks: number | null;
    project_total_area_sqm: number | null;
    construction_status: string | null;
    completion_date: string | null;
    number_of_phases: number | null;
    furniture_package: string | null;
    rental_guarantee: boolean;
    payment_plan: PaymentPlan | null;
    facilities: string[] | null;
    distances: ProjectDistances | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Relations (when loaded)
    developer?: Developer;
    location?: ProjectLocation;
    expose_config?: DeveloperProjectExposeConfig;
    properties?: Property[];
    unit_types_details?: DeveloperProjectUnitType[];
    assets?: DeveloperProjectAsset[];
    thumbnail?: DeveloperProjectAsset;
    // Offers
    offers?: import("./api/offers").Offer[];
    offers_count?: number;
    // Computed
    properties_count?: number;
    sold_properties_count?: number;
}

export interface PaymentPlan {
    enabled: boolean;
    downpayment_type?: "percentage" | "amount";
    downpayment_value?: number;
    period_months?: number;
    interest_rate?: number;
}

export interface ProjectDistances {
    sea_km?: number;
    hospital_km?: number;
    market_km?: number;
    school_km?: number;
    airport_km?: number;
    beach_km?: number;
}

// Minimal version for dropdowns
export interface DeveloperProjectOption {
    id: number;
    name: string;
    developer_id: number | null;
    project_location_id: number | null;
    developer?: {
        id: number;
        name: string;
    };
    location?: {
        id: number;
        name: string;
    };
}

// ============================================
// Developer Project Unit Type
// ============================================

export interface DeveloperProjectUnitType {
    id: number;
    company_id: number;
    developer_project_id: number;
    reference_code: string | null;
    // Category & Type
    primary_category: "residential" | "commercial";
    property_type: string | null;
    quantity: number | null;
    total_sold: number | null;
    is_sold_out?: boolean;
    unit_style: string[] | null;
    view_types: string[] | null;
    furniture_status: string | null;
    // Pricing
    starting_price: number | null;
    currency: string;
    // Specifications
    bedrooms: number | null;
    bathrooms: number | null;
    floor: string | null;
    floors_in_building: number | null;
    total_area_sqm: number | null;
    living_area_sqm: number | null;
    terrace_balcony_sqm: number | null;
    plot_size_sqm: number | null;
    completion_date: string | null;
    // Features
    outside_features: string[] | null;
    inside_features: string[] | null;
    // Description
    description: string | null;
    // Legal
    military_base_distance_km: number | null;
    has_restrictions: boolean;
    restriction_notes: string | null;
    // Meta
    order: number;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Relations
    assets?: DeveloperProjectUnitTypeAsset[];
    // Offers
    offers?: import("./api/offers").Offer[];
    offers_count?: number;
    active_offers?: import("./api/offers").Offer[];
    // Computed
    display_label?: string;
    formatted_price?: string;
    currency_symbol?: string;
}
export interface DeveloperProjectUnitTypeAsset {
    id: number;
    unit_type_id: number;
    company_id: number;
    name: string | null;
    asset_type: "image" | "video" | "video_url";
    file_path: string | null;
    external_url: string | null;
    mime_type: string | null;
    file_size: number | null;
    tags: string[] | null;
    metadata: Record<string, any> | null;
    order: number;
    url: string | null;
    created_at: string;
    updated_at: string;
}

// ============================================
// Expose Configuration Types
// ============================================

// Keys for grouped images - must match backend constants
export const GROUPED_IMAGE_KEYS = [
    "3-block-images",
    "floor-plans",
    "site-images",
    "other-images",
] as const;

export type GroupedImageKey = (typeof GROUPED_IMAGE_KEYS)[number];

// Keys for info blocks - must match backend constants
export const INFO_BLOCK_KEYS = ["garden-serenity"] as const;

export type InfoBlockKey = (typeof INFO_BLOCK_KEYS)[number];

export interface InfoBlock {
    title: string;
    subTitle: string;
    content: string[];
}

export interface ExposeLogoConfig {
    dark: string;
    light: string;
}

export interface ExposeFacility {
    name: string;
    image: string;
}

export interface ExposeProjectOverview {
    city: string;
    propertyTypes: string[];
    completionDate: string;
    facilities: ExposeFacility[];
    propertyOverviewImage: string;
}

export interface ExposeCostProperty {
    type: string;
    floor: string;
    price: number;
    units: number;
}

export interface ExposeAdditionalCost {
    type: string;
    amount: number;
}

export interface ExposeRentalProperty {
    type: string;
    floor: string;
    expectedRent: number;
    units: number;
}

export interface ExposeDeductible {
    type: string;
    amount: number;
}

export interface ExposeMonetaryEvaluation {
    cost: {
        properties: ExposeCostProperty[];
        additionalCosts: ExposeAdditionalCost[];
        totalCost: number;
    };
    expectedRentalIncome: {
        properties: ExposeRentalProperty[];
        deductibles: ExposeDeductible[];
        totalIncome: number;
    };
    expectedCapitalGrowth: Record<string, number>; // year -> growth amount
}

export interface ExposeAgent {
    name: string;
    position: string;
}

export interface ExposeContactDetails {
    agent: ExposeAgent;
    phones: string[];
    emails: string[];
    websites: string[];
    addresses: string[];
}

export interface ExposeClientDetails {
    name: string;
    email: string;
}

// The full expose config as stored in the database
export interface DeveloperProjectExposeConfig {
    id: number;
    developer_project_id: number;
    logo: ExposeLogoConfig | null;
    project_overview: ExposeProjectOverview | null;
    grouped_images: Record<GroupedImageKey, string[]> | null;
    generic_images: string[] | null;
    info_blocks: Record<InfoBlockKey, InfoBlock> | null;
    monetary_evaluation: ExposeMonetaryEvaluation | null;
    contact_details: ExposeContactDetails | null;
    created_at: string;
    updated_at: string;
    // Computed from relation
    location_details?: LocationConfig | null;
}

// LocationConfig as expected by the expose template
export interface LocationConfig {
    name: string;
    description: string;
    address: LocationAddress;
    map: string;
    attractions: LocationAttraction[];
    infrastructure: LocationInfrastructure[];
    airports: LocationAirport[];
}

// The complete expose data structure sent to PDF templates
export interface ExposeProjectConfigData {
    logo: ExposeLogoConfig;
    projectOverview: ExposeProjectOverview;
    groupedImages: Record<GroupedImageKey, string[]>;
    genericImages: string[];
    infoBlocks: Record<InfoBlockKey, InfoBlock>;
    monetaryEvaluation: ExposeMonetaryEvaluation;
    locationDetails: LocationConfig;
    contactDetails: ExposeContactDetails;
    clientDetails: ExposeClientDetails;
}

// ============================================
// Form/Input Types for UI
// ============================================

// Input types for form submission (uses name-based structure for simplicity)
export interface LocationInfrastructureInput {
    infrastructure_id?: number;
    name?: string;
    travelTimeInMin: number;
    image?: string;
}

export interface LocationAirportInput {
    airport_id?: number;
    name?: string;
    travelTimeInMin: number;
    image?: string;
}

export interface CreateProjectLocationInput {
    name: string;
    description?: string;
    address?: LocationAddress;
    map_url?: string;
    image_url?: string;
    attractions?: LocationAttraction[];
    infrastructure?: LocationInfrastructureInput[];
    airports?: LocationAirportInput[];
}

export interface UpdateProjectLocationInput extends Partial<CreateProjectLocationInput> {}

export interface CreateDeveloperProjectInput {
    name: string;
    description?: string;
    developer_id?: number;
    project_location_id?: number;
}

export interface UpdateDeveloperProjectInput extends Partial<CreateDeveloperProjectInput> {}

export interface AssignPropertiesInput {
    property_ids: number[];
}

export interface UpdateExposeConfigInput {
    logo?: ExposeLogoConfig;
    project_overview?: ExposeProjectOverview;
    grouped_images?: Record<GroupedImageKey, string[]>;
    generic_images?: string[];
    info_blocks?: Record<InfoBlockKey, InfoBlock>;
    monetary_evaluation?: ExposeMonetaryEvaluation;
    contact_details?: ExposeContactDetails;
}

export interface UpdateExposeSectionInput {
    data: any; // The section-specific data
}

export interface ExposePreviewInput {
    client_name?: string;
    client_email?: string;
}

// ============================================
// API Response Types
// ============================================

export interface ProjectLocationListResponse {
    status: "success";
    message: string;
    locations: {
        data: ProjectLocation[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface DeveloperProjectListResponse {
    status: "success";
    message: string;
    projects: {
        data: DeveloperProject[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface ExposeConfigResponse {
    status: "success";
    message: string;
    config: DeveloperProjectExposeConfig | null;
    project: DeveloperProject;
}

export interface ExposePreviewResponse {
    status: "success";
    message: string;
    exposeData: ExposeProjectConfigData;
    project: {
        id: number;
        name: string;
        property_count: number;
    };
}

export interface ExposeValidationResponse {
    status: "success" | "fail";
    message: string;
    data?: {
        missing: string[];
    };
}

// Import Property type from existing types (for relations)
import type { Property } from "./index";

export type { Property };
