import type { Product } from "./deals";
import type {
    Developer,
    DeveloperProject,
    DeveloperProjectUnitType,
} from "../developerProject";

export type OfferType = "percentage" | "fixed" | "perks";

export interface OfferablePivot {
    is_active: boolean;
    disabled_at: string | null;
    disabled_by: number | null;
}

export interface Offer {
    id: number;
    company_id: number;
    developer_id: number | null;
    name: string;
    description: string | null;
    type: OfferType;
    value: number | null;
    max_discount_amount: number | null;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    added_by: number | null;
    last_updated_by: number | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Links
    links?: { label: string; url: string }[] | null;
    // Relations (when loaded)
    developer?: Developer;
    developer_projects?: (DeveloperProject & { pivot?: OfferablePivot })[];
    unit_types?: (DeveloperProjectUnitType & { pivot?: OfferablePivot })[];
    // Counts
    deal_applications_count?: number;
    developer_projects_count?: number;
    unit_types_count?: number;
}

export interface DealOfferApplication {
    id: number;
    deal_id: number;
    offer_id: number;
    product_id: number;
    resolved_from_type: string;
    resolved_from_id: number;
    original_amount: number;
    discount_amount: number;
    offer_type: OfferType;
    offer_value: number;
    created_at: string;
    updated_at: string;
    // Relations (when loaded)
    offer?: Offer;
    product?: Product & {
        property?: {
            id: number;
            title: string | null;
            property_type: string | null;
        } | null;
    };
    resolved_from?: DeveloperProject | DeveloperProjectUnitType;
}

export interface DealOffersResponse {
    status: string;
    applications: DealOfferApplication[];
    total_discount: number;
}

export interface OfferFormValues {
    developer_id: number;
    name: string;
    description?: string | null;
    type: OfferType;
    value?: number | null;
    max_discount_amount?: number | null;
    is_active: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    project_ids?: number[];
    unit_type_ids?: number[];
    links?: { label: string; url: string }[] | null;
}

export interface PaginatedOfferResponse {
    current_page: number;
    data: Offer[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    links: { url: string | null; label: string; active: boolean }[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}
