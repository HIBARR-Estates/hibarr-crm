/**
 * Property Recommendation Types
 * Types for the external property recommendation API integration
 */

import { Property } from "@/Types";

/**
 * A property recommendation returned from the recommendation engine
 */
export interface PropertyRecommendation {
    /** Rank in the recommendation list (1-based) */
    rank: number;
    /** The property ID */
    property_id: number | null;
    /** Compatibility score (0-1) */
    score: number | null;
    /** Match percentage (0-100) */
    match_percentage: number | null;
    /** Factors that contributed to the match */
    factors: MatchFactor[];
    /** Enriched local property data (if available) */
    property: PropertySummary | null;
    /** Raw data from the recommendation API */
    raw: Record<string, unknown>;
}

/**
 * A factor that contributed to the property match
 */
export interface MatchFactor {
    /** Factor name/key (e.g., "budget", "bedrooms", "type", "features") */
    name: string;
    /** Factor score (0-100) */
    score: number;
    /** Status label (e.g., "Excellent", "Good", "Standard", "Poor") */
    status: string;
    /** Detailed description of the match (e.g., "Well within budget") */
    detail: string;
    /** Factor value or description (legacy/optional) */
    value?: string | number;
    /** Weight or importance of this factor (optional) */
    weight?: number;
    /** Whether this factor was a positive match (optional) */
    positive?: boolean;
}

/**
 * Summary property data for display in recommendations
 */
export interface PropertySummary {
    id: number;
    title: string;
    property_type: string;
    sale_type: "sale" | "rent";
    price: number;
    city: string;
    area: string;
    bedrooms: number | null;
    bathrooms: number | null;
    land_size: number | null;
    status: string;
    primary_photo: string | null;
    photos_count: number;
}

/**
 * Contact/Customer summary for recommendation context
 */
export interface ContactSummary {
    id: number;
    name: string;
    email: string;
}

/**
 * Response from the recommendations endpoint
 */
export interface RecommendationsResponse {
    status: "success" | "error";
    deal_id: number;
    contact: ContactSummary | null;
    recommendations: PropertyRecommendation[];
    cached: boolean;
    error: string | null;
}

/**
 * Response from the compatibility endpoint
 */
export interface CompatibilityResponse {
    status: "success" | "error";
    deal_id: number;
    property_id: number;
    /** Customer ID */
    customer_id?: number;
    /** Overall compatibility score (0-1) */
    score: number | null;
    /** Overall score from API (0-1) */
    overall_score?: number | null;
    /** Match percentage (0-100) */
    match_percentage: number | null;
    /** Detailed factors contributing to the score */
    factors: MatchFactor[];
    /** AI reasoning for the recommendation (if available) */
    reasoning: string | null;
    /** Processing time in milliseconds */
    processing_time_ms?: number;
    error: string | null;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
    status: "success" | "error";
    healthy: boolean;
    message: string;
}
