import type {
    MatchFactor,
    PropertyRecommendation,
} from "@/Types/api/property-recommendation";

export type WorkspaceRecommendationMatchVariant = "green" | "blue" | "gray";

export interface WorkspaceRecommendationListItem {
    id: number;
    rank: number;
    propertyTitle: string;
    priceLabel: string;
    matchPercentage: number | null;
    matchBadgeVariant: WorkspaceRecommendationMatchVariant;
    reasoningNotes: string | null;
    locationLabel: string | null;
    typeLabel: string | null;
    specsLabel: string | null;
    statusLabel: string | null;
    statusBadgeVariant: "green" | "blue" | "gray" | "navy";
    propertyHref: string | null;
    propertyId: number | null;
    isInDeal: boolean;
}

function formatPrice(price: number | null | undefined): string {
    if (!price) return "N/A";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(price);
}

function resolveMatchBadgeVariant(
    percentage: number | null,
): WorkspaceRecommendationMatchVariant {
    if (!percentage) return "gray";
    if (percentage >= 85) return "green";
    if (percentage >= 70) return "blue";
    return "gray";
}

function resolveStatusBadgeVariant(
    status: string,
): "green" | "blue" | "gray" | "navy" {
    const colors: Record<string, "green" | "blue" | "gray" | "navy"> = {
        available: "green",
        under_offer: "navy",
        sold: "gray",
        rented: "blue",
        withdrawn: "gray",
    };
    return colors[status] || "gray";
}

function buildReasoningNotes(factors: MatchFactor[]): string | null {
    if (!factors?.length) return null;

    const parts = factors
        .map((factor) => factor.detail || factor.status)
        .filter(Boolean);

    return parts.length ? parts.join(" · ") : null;
}

export function getPropertyShowHref(
    propertyId: number | null | undefined,
): string | null {
    if (!propertyId) return null;

    try {
        return route("properties.show", { property: propertyId });
    } catch (primaryError) {
        try {
            return route("properties.show", { id: propertyId });
        } catch (fallbackError) {
            console.error(
                "Failed to build properties.show URL for recommendation",
                { propertyId, primaryError, fallbackError },
            );
            return null;
        }
    }
}

export function toWorkspaceRecommendationListItem(
    recommendation: PropertyRecommendation,
    options: {
        existingProductIds: number[];
    },
): WorkspaceRecommendationListItem {
    const { property, match_percentage, rank, factors } = recommendation;
    const propertyId = property?.id ?? recommendation.property_id ?? null;

    const typeLabel =
        property?.property_type && property?.sale_type
            ? `${property.property_type.replace("_", " ")} for ${property.sale_type}`
            : null;

    const locationParts = [property?.area, property?.city].filter(Boolean);
    const locationLabel =
        locationParts.length > 0 ? locationParts.join(", ") : null;

    const specParts: string[] = [];
    if (property?.bedrooms) specParts.push(`${property.bedrooms} Beds`);
    if (property?.bathrooms) specParts.push(`${property.bathrooms} Baths`);
    if (property?.land_size) specParts.push(`${property.land_size} m²`);
    const specsLabel = specParts.length > 0 ? specParts.join(" · ") : null;

    const statusLabel = property?.status
        ? property.status.replace("_", " ")
        : null;

    return {
        id: rank,
        rank,
        propertyTitle: property?.title || `Property #${rank}`,
        priceLabel: formatPrice(property?.price),
        matchPercentage: match_percentage,
        matchBadgeVariant: resolveMatchBadgeVariant(match_percentage),
        reasoningNotes: buildReasoningNotes(factors),
        locationLabel,
        typeLabel,
        specsLabel,
        statusLabel,
        statusBadgeVariant: property?.status
            ? resolveStatusBadgeVariant(property.status)
            : "gray",
        propertyHref: getPropertyShowHref(propertyId),
        propertyId,
        isInDeal: propertyId
            ? options.existingProductIds.includes(propertyId)
            : false,
    };
}
