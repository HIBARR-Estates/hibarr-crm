export type PortfolioView = "deals" | "browse" | "projects";

export interface PortfolioProperty {
    id: number;
    title: string;
    project: string | null;
    developer: string | null;
    city: string | null;
    area: string | null;
    bedrooms: number | null;
    size_sqm: number | null;
    price: number | null;
    currency: string | null;
    construction_status: string | null;
    status: string | null;
    photo: string | null;
}

export interface MatchFactor {
    label: string;
    positive: boolean;
}

export interface Recommendation extends PortfolioProperty {
    match: number | null;
    factors: MatchFactor[];
}

export interface PortfolioDeal {
    id: number;
    lead_id: number | null;
    name: string;
    person: string | null;
    stage: string | null;
    interested_in: string | null;
    budget_range: string | null;
    purchase_timeline: string | null;
}

export interface RecommendationsPayload {
    items: Recommendation[];
    error: string | null;
}

export interface PropertiesPayload {
    items: PortfolioProperty[];
    total: number;
}

export interface NamedOption {
    name: string;
    label: string;
}

export interface BrowseOptions {
    cities: NamedOption[];
    areas: string[];
    construction_statuses: NamedOption[];
    deed_statuses: NamedOption[];
    developers: Array<{ id: number; name: string }>;
}

export type BrowseFilters = Partial<Record<"search" | "city" | "area" | "max_price" | "min_bedrooms" | "construction_status" | "deed_status" | "developer_id", string>>;

export interface PortfolioUnitType {
    id: number;
    label: string;
    available: number;
    total: number;
}

export interface PortfolioProject {
    id: number;
    name: string;
    developer: string | null;
    location: string | null;
    construction_status: string | null;
    starting_price: number | null;
    currency: string;
    completion_date: string | null;
    unit_types: PortfolioUnitType[];
}
