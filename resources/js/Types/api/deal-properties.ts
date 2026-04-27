import type { DeveloperProjectUnitType } from "@/Types/developerProject";
import type { Offer, OfferType } from "@/Types/api/offers";

export interface AppliedOfferApplication {
    id: number;
    offer_id: number;
    offer?: Pick<
        Offer,
        "id" | "name" | "type" | "value" | "max_discount_amount" | "ends_at"
    >;
    discount_amount: number;
    offer_type: OfferType;
    offer_value: number;
}

export interface AttachedProperty {
    product_id: number;
    product_name: string;
    property: {
        id: number;
        title: string | null;
        property_type: string | null;
        sale_type: string | null;
        price: number | null;
        bedrooms: number | null;
        bathrooms: number | null;
        city: string | null;
        area: string | null;
        land_size: string | null;
        status: string | null;
        photos: string[] | null;
        view_types: string[] | null;
        floor_number: number | null;
        living_area_sqm: number | null;
        outside_features: string[] | null;
        inside_features: string[] | null;
        developer_project?: {
            id: number;
            name: string;
            availability_link: string | null;
        } | null;
    } | null;
    offer_applications: AppliedOfferApplication[];
}

export interface PropertySearchResult {
    id: number;
    title: string | null;
    property_type: string | null;
    sale_type: string | null;
    price: number | null;
    city: string | null;
    area: string | null;
    status: string | null;
    photos: string[] | null;
    bedrooms: number | null;
    bathrooms: number | null;
}

export interface AttachPropertyPayload {
    property_id?: number;
    unit_type_id?: number;
    price?: number;
    floor_number?: string;
    view_types?: string[];
    outside_features?: string[];
    inside_features?: string[];
    offer_ids?: number[];
}

export interface ProjectUnitTypesResponse {
    status: string;
    data: DeveloperProjectUnitType[];
    project: {
        id: number;
        name: string;
        availability_link: string | null;
        google_drive_link: string | null;
    };
}
