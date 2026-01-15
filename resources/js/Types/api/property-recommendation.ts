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
    /** Factor name/key */
    name: string;
    /** Factor value or description */
    value: string | number;
    /** Weight or importance of this factor */
    weight?: number;
    /** Whether this factor was a positive match */
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
    score: number | null;
    match_percentage: number | null;
    factors: MatchFactor[];
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
