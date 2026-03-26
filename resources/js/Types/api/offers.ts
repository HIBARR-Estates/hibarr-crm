import type { Product } from "./deals";
import type {
    DeveloperProject,
    DeveloperProjectUnitType,
} from "../developerProject";

export type OfferType = "percentage" | "fixed";

export interface Offer {
    id: number;
    company_id: number;
    name: string;
    description: string | null;
    type: OfferType;
    value: number;
    max_discount_amount: number | null;
    is_active: boolean;
    starts_at: string | null;
    ends_at: string | null;
    added_by: number | null;
    last_updated_by: number | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    // Relations (when loaded)
    developer_projects?: DeveloperProject[];
    unit_types?: DeveloperProjectUnitType[];
    // Counts
    deal_applications_count?: number;
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
    product?: Product;
    resolved_from?: DeveloperProject | DeveloperProjectUnitType;
}

export interface OfferFormValues {
    name: string;
    description?: string | null;
    type: OfferType;
    value: number;
    max_discount_amount?: number | null;
    is_active: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
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
