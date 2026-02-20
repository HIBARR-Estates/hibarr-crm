import { Property } from "@/Types";
import { TFilter } from "@/Types/common";

export const isLoading = ({
    isError,
    isLoading,
    status,
}: Partial<{
    isLoading: boolean;
    isError: boolean;
    status: "idle" | "error" | "success" | "pending";
}>): boolean => {
    if (status === "pending") return true;
    return isLoading === true && isError !== true;
};

export const pluralOrSingular = (
    count: number,
    singular: string,
    plural: string,
) => {
    return count === 1 ? singular : `${count} ${plural}`;
};

export const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        available: "#bdbec3",
        under_offer: "orange",
        sold: "red",
        rented: "blue",
        withdrawn: "default",
        pending: "#faad14",
        error: "#ff4d4f",
        success: "#52c41a",
        idle: "gray",
        default: "#d9d9d9",
        completed: "green",
        cancelled: "red",
        scheduled: "blue",
        accepted: "#52c41a",
        declined: "#ff4d4f",
        rejected: "#ff4d4f",
        started: "#1890ff",
        paused: "#faad14",
        closed: "#595959",
    };
    return colors[status] || "default";
};

export const getPropertyTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
        Villa: "purple",
        Apartment: "blue",
        House: "green",
        Office: "orange",
        Shop: "red",
        Warehouse: "default",
    };
    return colors[type] || "default";
};

export const formatCurrency = (
    amount: number,
    currencyCode: string | null | undefined = "GBP",
): string => {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currencyCode || "GBP",
        minimumFractionDigits: 0,
    }).format(amount);
};

// Property price can be stored as:
// - number (legacy)
// - JSON string: {"amount":1000,"currency":"TRY"}
// - object: {amount, currency}
export const parsePropertyPrice = (
    price: any,
    defaultCurrency: string = "TRY",
): { amount: number; currency: string } => {
    const fallback = { amount: 0, currency: defaultCurrency };

    if (price === null || price === undefined) return fallback;

    // number
    if (typeof price === "number" && !isNaN(price)) {
        return { amount: price, currency: defaultCurrency };
    }

    // string: numeric or JSON
    if (typeof price === "string") {
        const trimmed = price.trim();
        if (!trimmed) return fallback;

        // numeric string
        const asNum = Number(trimmed);
        if (!isNaN(asNum)) {
            return { amount: asNum, currency: defaultCurrency };
        }

        // JSON string
        try {
            const parsed = JSON.parse(trimmed);
            if (typeof parsed === "number" && !isNaN(parsed)) {
                return { amount: parsed, currency: defaultCurrency };
            }
            if (parsed && typeof parsed === "object") {
                const amount = Number((parsed as any).amount);
                const currency = (parsed as any).currency || defaultCurrency;
                return {
                    amount: !isNaN(amount) ? amount : 0,
                    currency,
                };
            }
        } catch {
            return fallback;
        }
    }

    // object
    if (typeof price === "object") {
        const amount = Number((price as any).amount);
        const currency = (price as any).currency || defaultCurrency;
        return {
            amount: !isNaN(amount) ? amount : 0,
            currency,
        };
    }

    return fallback;
};

export const formatNumber = (amount: number): string => {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatCurrencyWithSymbol = (
    amount: number,
    symbol: string,
): string => {
    const s = symbol || "";
    return `${s}${formatNumber(amount)}`;
};

export const truncateText = (text: string, maxLength: number = 200): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
};

export const filterProperties = (
    data: Property[],
    filters: TFilter,
): Property[] => {
    return data.filter((property) => {
        // Search filter - check title, description, city, and area
        if (filters.search && filters.search.trim()) {
            const searchTerm = filters.search.toLowerCase();
            const matchesSearch =
                property.title.toLowerCase().includes(searchTerm) ||
                (property.description &&
                    property.description.toLowerCase().includes(searchTerm)) ||
                property.city.toLowerCase().includes(searchTerm) ||
                property.area.toLowerCase().includes(searchTerm);

            if (!matchesSearch) return false;
        }

        // Property type filter
        if (filters.property_type && filters.property_type !== "all") {
            if (property.property_type !== filters.property_type) return false;
        }

        // Sale type filter
        if (filters.sale_type && filters.sale_type !== "all") {
            if (property.sale_type !== filters.sale_type) return false;
        }

        // Status filter
        if (filters.status && filters.status !== "all") {
            if (property.status !== filters.status) return false;
        }

        // City filter
        if (filters.city && filters.city.trim()) {
            if (
                !property.city
                    .toLowerCase()
                    .includes(filters.city.toLowerCase())
            )
                return false;
        }

        // Price range filters
        if (filters.min_price !== undefined && filters.min_price !== null) {
            if (property.price < filters.min_price) return false;
        }

        if (filters.max_price !== undefined && filters.max_price !== null) {
            if (property.price > filters.max_price) return false;
        }

        return true;
    });
};

/**
 * Minimal shape accepted by generatePropertySubtitle.
 * Both Property and DeveloperProjectUnitType satisfy this.
 */
export interface SubtitleableRecord {
    bedrooms?: number | null;
    unit_style?: string[] | null;
    property_type?: string | null;
    view_types?: string[] | null;
    furniture_status?: string | null;
    primary_category?: string | null;
    construction_status?: string | null;
    city?: string | null;
    area?: string | null;
    effective_location?: { city?: string | null; area?: string | null } | null;
}

/**
 * Generate a human-readable property subtitle using a fallthrough narrative strategy.
 *
 * Accepts any record that satisfies SubtitleableRecord — this includes
 * Property, DeveloperProjectUnitType (with city/area provided), or the
 * transformed unit-type shape from UnitTypePropertyTransformer.
 *
 * Sequence:
 *  1. The Elevated Living   – Beds + Unit Style + Property Type + View Type + Furniture
 *  2. The Vista Narrative   – View Type + Unit Style + Property Type + Beds
 *  3. The Architectural Hook– Unit Style + Property Type + Location + Beds
 *  4. The Setting Focus     – Property Type + View Type + Location
 *  5. The Distinction       – Primary Category + Property Type + Beds
 *  6. The Foundation        – Property Type + Location (catch-all)
 */
export const generatePropertySubtitle = (
    record: SubtitleableRecord,
): string | null => {
    const beds = record.bedrooms;
    const unitStyle =
        Array.isArray(record.unit_style) && record.unit_style.length > 0
            ? record.unit_style.map(formatEnumLabel).join(" / ")
            : null;
    const propertyType = record.property_type;
    const viewType = formatViewTypes(record.view_types);
    const furniture = formatFurniture(record.furniture_status);
    const location = resolveLocation(record);
    const category = formatEnumLabel(record.primary_category);
    const constructionStatus = formatEnumLabel(record.construction_status);

    const hasBeds = beds !== undefined && beds !== null && beds > 0;
    const hasUnitStyle = !!unitStyle;
    const hasPropertyType = !!propertyType;
    const hasViewType = !!viewType;
    const hasFurniture = !!furniture;
    const hasLocation = !!location;
    const hasCategory = !!category;
    const hasConstructionStatus = !!constructionStatus;

    let value: string | null = null;

    // 1. The Elevated Living
    if (
        hasBeds &&
        hasUnitStyle &&
        hasPropertyType &&
        hasViewType &&
        hasFurniture
    ) {
        value = `${beds} Bedroom ${unitStyle} ${propertyType} with ${viewType} and ${furniture} interiors`;
    }

    // 2. The Vista Narrative
    if (hasViewType && hasUnitStyle && hasPropertyType && hasBeds) {
        const furniturePart = hasFurniture
            ? ` featuring ${furniture} finishes and`
            : " with";
        value = `${viewType} ${unitStyle} ${propertyType}${furniturePart} ${beds} Bedrooms`;
    }

    // 3. The Architectural Hook
    if (hasUnitStyle && hasPropertyType && hasLocation && hasBeds) {
        const furniturePart = hasFurniture ? ` and ${furniture} interiors` : "";
        value = `${unitStyle} ${propertyType} in ${location} with ${beds} Bedrooms${furniturePart}`;
    }

    // 4. The Setting Focus
    if (hasPropertyType && hasViewType && hasLocation) {
        const bedsPart = hasBeds ? ` with ${beds} Bedrooms` : "";
        value = `${propertyType} set within ${viewType} surroundings in ${location}${bedsPart}`;
    }

    // 5. The Distinction
    if (hasCategory && hasPropertyType && hasBeds) {
        const furniturePart = hasFurniture ? `${furniture} ` : "";
        const viewPart = hasViewType ? ` capturing ${viewType}` : "";
        value = `${furniturePart}${beds} Bedroom ${category} ${propertyType}${viewPart}`;
    }

    // 6. The Foundation (catch-all)
    if (hasPropertyType) {
        const statusPart = hasConstructionStatus
            ? `${constructionStatus} `
            : "";
        const locationPart = hasLocation ? ` in ${location}` : "";
        value = `${statusPart}${propertyType}${locationPart}`;
    }

    return value?.split("_").join(" ").trim() || null;
};

/** Format an enum value like "studio" or "part_furnished" into "Studio" or "Part Furnished" */
const formatEnumLabel = (value?: string | null): string | null => {
    if (!value) return null;
    return value
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

/** Join view_types array into a readable string: "Sea View", "Sea & Mountain View" */
const formatViewTypes = (viewTypes?: string[] | null): string | null => {
    if (!viewTypes || viewTypes.length === 0) return null;
    if (viewTypes.length === 1) return viewTypes[0];
    if (viewTypes.length === 2) return `${viewTypes[0]} & ${viewTypes[1]}`;
    return `${viewTypes.slice(0, -1).join(", ")} & ${viewTypes[viewTypes.length - 1]}`;
};

/** Normalise furniture_status into a concise adjective form */
const formatFurniture = (status?: string | null): string | null => {
    if (!status) return null;
    const map: Record<string, string> = {
        "Fully Furnished": "Fully Furnished",
        "Part Furnished": "Part Furnished",
        "Semi-Furnished": "Semi-Furnished",
        Unfurnished: "Unfurnished",
        "White Goods Only": "White Goods",
    };
    return map[status] ?? formatEnumLabel(status);
};

/** Resolve the best available location string from effective_location or direct fields */
const resolveLocation = (record: SubtitleableRecord): string | null => {
    const city = record.effective_location?.city ?? record.city;
    const area = record.effective_location?.area ?? record.area;
    if (city && area) return `${area}, ${city}`;
    return city || area || null;
};

/**
 * Format country for display in tables/cards. Handles both string (e.g. "United States")
 * and object from API (e.g. { id, nicename, name }) so it never renders as [object Object].
 */
export function formatCountryForDisplay(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "object" && value !== null) {
        const o = value as Record<string, unknown>;
        const name =
            (o.nicename as string) ??
            (o.name as string) ??
            (o.nationality as string) ??
            "";
        if (typeof name === "string" && name.trim()) return name.trim();
        return "";
    }
    return String(value);
}

/**
 * Format mobile/phone for display. Handles string, JSON string, or object (e.g. { phone, country_code })
 * so it never renders as [object Object] and shows a readable number like +90 533 877 3001.
 */
export function formatMobileForDisplay(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.startsWith("+") || /^\d[\d\s().-]*$/.test(trimmed))
            return trimmed;
        try {
            const parsed = JSON.parse(trimmed) as Record<string, unknown>;
            if (
                parsed &&
                typeof parsed === "object" &&
                typeof parsed.phone === "string"
            )
                return parsed.phone.trim();
            const fromParts = [
                parsed.countryCode,
                parsed.areaCode,
                parsed.phoneNumber,
            ]
                .filter(Boolean)
                .map((p) => String(p).replace(/\D/g, ""))
                .join("");
            if (fromParts) return "+" + fromParts;
            return "";
        } catch {
            return trimmed;
        }
    }
    if (typeof value === "object" && value !== null) {
        const o = value as Record<string, unknown>;
        if (typeof o.phone === "string" && o.phone.trim())
            return o.phone.trim();
        const fromParts = [o.countryCode, o.areaCode, o.phoneNumber]
            .filter(Boolean)
            .map((p) => String(p).replace(/\D/g, ""))
            .join("");
        if (fromParts) return "+" + fromParts;
        return "";
    }
    return String(value);
}
