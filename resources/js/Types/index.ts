import { ErrorBag, Errors, Page } from "@inertiajs/core";

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

// Property Types
export interface Property {
    id: number;
    product_id: number;
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
    exterior_features?: string[] | null;
    interior_features?: string[] | null;
    location_features?: string[] | null;
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
export interface PropertyIndexProps extends Page {
    props: {
        properties: Pagination<Property>;
        products: Product[];
        filters: PropertyFilters;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyCreateProps extends Page {
    props: {
        products: Product[];
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyEditProps extends Page {
    props: {
        property: Property;
        products: Product[];
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

export interface PropertyShowProps extends Page {
    props: {
        property: Property;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}

// Common Types
export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
    created_at: string;
    updated_at: string;
}

export interface FlashMessage {
    type: "success" | "error" | "info" | "warning";
    message: string;
}

export interface AppProps extends Page {
    props: {
        auth: {
            user: User;
        };
        flash?: FlashMessage;
        errors: Errors & ErrorBag;
        deferred?: Record<string, string[] | undefined>;
    };
}
