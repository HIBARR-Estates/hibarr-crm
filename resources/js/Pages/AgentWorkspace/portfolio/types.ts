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

/** Where a paged list stands: the page shown and the range it covers. */
export interface PageNumbers {
    page: number;
    last_page: number;
    per_page: number;
    from: number;
    to: number;
}

export interface PropertiesPayload extends PageNumbers {
    items: PortfolioProperty[];
    total: number;
}

export interface ProjectsPayload extends PageNumbers {
    items: PortfolioProject[];
    total: number;
}

export interface PortfolioPipeline {
    id: number;
    name: string;
}

/** The For my deals rail's page (the deals themselves come as `deals`). */
export interface DealsPageMeta extends PageNumbers {
    total: number;
}

export interface NamedOption {
    name: string;
    label: string;
}

export interface BrowseOptions {
    cities: NamedOption[];
    areas: NamedOption[];
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
    developer_logo: string | null;
    location: string | null;
    construction_status: string | null;
    starting_price: number | null;
    currency: string;
    completion_date: string | null;
    thumbnail: string | null;
    unit_types: PortfolioUnitType[];
}

export type ProjectFilters = Record<string, string | undefined>;

export interface ProjectOptions {
    developers: Array<{ id: number; name: string }>;
    locations: Array<{ id: number; name: string; city: string | null; area: string | null }>;
    construction_statuses: NamedOption[];
}
