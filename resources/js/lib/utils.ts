import { Property } from "@/Types";
import { TFilter } from "@/Types/common";

/**
 * navigator.clipboard is only defined in secure contexts (HTTPS/localhost) —
 * on plain-HTTP internal/staging hosts it's `undefined` and `.writeText`
 * throws, so callers relying on it alone silently fail to copy anything.
 * Falls back to the legacy execCommand approach there.
 */
export async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        if (!document.execCommand("copy")) {
            throw new Error("execCommand copy failed");
        }
    } finally {
        document.body.removeChild(textarea);
    }
}

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

export const capitalizeFirstLetter = (text: string | null = ""): string => {
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
};

const TITLE_CASE_LOCALE = "tr-TR";

/** Title-case a single word using locale-aware casing (handles Turkish i/ı, ç, ğ, etc.). */
const titleCaseWord = (word: string): string => {
    const lower = word.toLocaleLowerCase(TITLE_CASE_LOCALE);
    if (!lower) return lower;
    return (
        lower.charAt(0).toLocaleUpperCase(TITLE_CASE_LOCALE) + lower.slice(1)
    );
};

/** Convert snake_case (or kebab-case) to Title Case readable text.
 *  e.g. "semi_detached_villa" → "Semi Detached Villa"
 */
export const snakeToReadable = (str: string | null | undefined): string => {
    if (!str) return "";
    return str
        .replace(/[-_]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map(titleCaseWord)
        .join(" ");
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

/** Parses a "range" custom field value (stored as JSON {min,max}) — same
 * string/object tolerance as parsePropertyPrice, for the same reason: the
 * value can arrive as a raw JSON string from storage or an already-parsed
 * object from local edit state. */
export const parseRangeValue = (
    value: any,
): { min: number | null; max: number | null } => {
    const fallback = { min: null, max: null };
    if (value === null || value === undefined) return fallback;

    let parsed = value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return fallback;
        }
    }

    if (parsed && typeof parsed === "object") {
        const min = Number((parsed as any).min);
        const max = Number((parsed as any).max);
        return {
            min: !isNaN(min) ? min : null,
            max: !isNaN(max) ? max : null,
        };
    }

    return fallback;
};

/** Same shape as parseRangeValue plus a currency code — for a "currency
 * range" field (e.g. a budget range). Legacy free-text values (this field
 * used to be a plain text input) won't match the {min,max,currency} JSON
 * shape and intentionally fall back to nulls rather than guessing at a
 * number from arbitrary text — they're still visible via a plain-text
 * fallback at the call site, just not editable as a structured range. */
export const parseCurrencyRangeValue = (
    value: any,
    defaultCurrency: string = "TRY",
): { min: number | null; max: number | null; currency: string } => {
    const fallback = { min: null, max: null, currency: defaultCurrency };
    if (value === null || value === undefined) return fallback;

    let parsed = value;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return fallback;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return fallback;
        }
    }

    if (parsed && typeof parsed === "object") {
        const min = Number((parsed as any).min);
        const max = Number((parsed as any).max);
        return {
            min: !isNaN(min) ? min : null,
            max: !isNaN(max) ? max : null,
            currency:
                typeof (parsed as any).currency === "string" &&
                (parsed as any).currency
                    ? (parsed as any).currency
                    : defaultCurrency,
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
    bedrooms?: number | null | { min: number | null; max: number | null };
    area?: string | null | { min: number | null; max: number | null };
    unit_style?: string[] | null;
    property_type?: string | null;
    view_types?: string[] | null;
    furniture_status?: string | null;
    primary_category?: string | null;
    construction_status?: string | null;
    city?: string | null;
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
    let beds: string | number | null = null;
    let hasBeds = false;

    // Normalise bedrooms: DB stores it as a string column (e.g. "2"), coerce to number.
    const bedroomsRaw = record.bedrooms;
    const bedroomsNormalized =
        typeof bedroomsRaw === "string" && !isNaN(Number(bedroomsRaw))
            ? Number(bedroomsRaw)
            : bedroomsRaw;

    if (typeof bedroomsNormalized === "number") {
        beds = bedroomsNormalized;
        hasBeds = beds > 0;
    } else if (bedroomsNormalized && typeof bedroomsNormalized === "object") {
        const { min, max } = bedroomsNormalized as {
            min: number | null;
            max: number | null;
        };
        if (min !== null && max !== null && min !== max) {
            beds = `${min}-${max}`;
            hasBeds = true;
        } else if (min !== null) {
            beds = min;
            hasBeds = min > 0;
        } else if (max !== null) {
            beds = max;
            hasBeds = max > 0;
        }
    }

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

    const hasUnitStyle = !!unitStyle;
    const hasPropertyType = !!propertyType;
    const hasViewType = !!viewType;
    const hasFurniture = !!furniture;
    const hasLocation = !!location;
    const hasCategory = !!category;
    const hasConstructionStatus = !!constructionStatus;

    const clean = (v: string) => v.split("_").join(" ").trim();

    // 1. The Elevated Living
    // Required: Beds + Unit Style + Property Type + View Type + Furniture
    if (
        hasBeds &&
        hasUnitStyle &&
        hasPropertyType &&
        hasViewType &&
        hasFurniture
    ) {
        return clean(
            `${beds} Bedroom ${unitStyle} ${propertyType} with ${viewType} and ${furniture} interiors`,
        );
    }

    // 2. The Vista Narrative
    // Required: View Type + Unit Style + Property Type + Furniture + Beds
    if (
        hasViewType &&
        hasUnitStyle &&
        hasPropertyType &&
        hasFurniture &&
        hasBeds
    ) {
        return clean(
            `${viewType} ${unitStyle} ${propertyType} featuring ${furniture} finishes and ${beds} Bedrooms`,
        );
    }

    // 3. The Architectural Hook
    // Required: Unit Style + Property Type + Location + Beds
    // Furniture optional in display but included when present
    if (hasUnitStyle && hasPropertyType && hasLocation && hasBeds) {
        const furniturePart = hasFurniture ? ` and ${furniture} interiors` : "";
        return clean(
            `${unitStyle} ${propertyType} in ${location} with ${beds} Bedrooms${furniturePart}`,
        );
    }

    // 4. The Setting Focus
    // Required: Property Type + View Type + Location + Beds
    if (hasPropertyType && hasViewType && hasLocation && hasBeds) {
        return clean(
            `${propertyType} set within ${viewType} surroundings in ${location} with ${beds} Bedrooms`,
        );
    }

    // 5. The Location Anchor
    // Required: Location + Unit Style + Property Type + Beds + View Type
    if (
        hasLocation &&
        hasUnitStyle &&
        hasPropertyType &&
        hasBeds &&
        hasViewType
    ) {
        return clean(
            `${location} ${unitStyle} ${propertyType} with ${beds} Bedrooms and ${viewType}`,
        );
    }

    // 5b. Beds + Unit Style + Property Type (no location — e.g. unit types without city)
    if (hasBeds && hasUnitStyle && hasPropertyType) {
        const viewPart = hasViewType ? ` and ${viewType}` : "";
        const furniturePart = hasFurniture
            ? ` with ${furniture} interiors`
            : "";
        return clean(
            `${beds} Bedroom ${unitStyle} ${propertyType}${viewPart}${furniturePart}`,
        );
    }

    // 5c. Beds + Property Type (minimal readable title)
    if (hasBeds && hasPropertyType) {
        const viewPart = hasViewType ? ` with ${viewType}` : "";
        const furniturePart = hasFurniture ? ` · ${furniture}` : "";
        return clean(
            `${beds} Bedroom ${propertyType}${viewPart}${furniturePart}`,
        );
    }

    // 6. The Distinction
    // Required: Furniture + Beds + Primary Category + Property Type + View Type
    if (
        hasFurniture &&
        hasBeds &&
        hasCategory &&
        hasPropertyType &&
        hasViewType
    ) {
        return clean(
            `${furniture} ${beds} Bedroom ${category} ${propertyType} capturing ${viewType}`,
        );
    }

    // 7. The Foundation (catch-all)
    // Required: Property Type (or Construction Status) + Location
    if (hasPropertyType || hasConstructionStatus) {
        const typePart =
            hasConstructionStatus && hasPropertyType
                ? `${constructionStatus} ${formatEnumLabel(propertyType)}`
                : hasConstructionStatus
                  ? `${constructionStatus}`
                  : `${formatEnumLabel(propertyType)}`;
        const locationPart = hasLocation ? ` in ${location}` : "";
        return clean(`${typePart}${locationPart}`);
    }

    return null;
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
    if (typeof city === "object" || typeof area === "object") return null; // Avoid [object Object]
    if (city && area) return `${area}, ${city}`;
    return city || area || null;
};

/**
 * Format a project location name for display (title case per word/segment).
 * Display-only — does not mutate stored values.
 * Handles "area, city" comma-separated names and snake_case segments.
 * e.g. "belek, antalya" → "Belek, Antalya"
 */
export function formatLocationNameForDisplay(
    name: string | null | undefined,
): string {
    if (name == null || name === "") return "";
    return name
        .split(",")
        .map((segment) => snakeToReadable(segment.trim()))
        .filter(Boolean)
        .join(", ");
}

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

type PhoneInputParts = {
    countryCode?: string | number | null;
    areaCode?: string | null;
    phoneNumber?: string | null;
};

/**
 * Serialize antd-phone-input onChange value while respecting the original stored format.
 * - When PhoneInput provides a countryCode, always emit E.164 (+prefix).
 * - When the library drops countryCode but the original was international, keep the original
 *   only if the user hasn't entered a new national number yet (avoids wiping in-progress edits).
 * - Local numbers without a country code keep local formatting (no forced +).
 */
export function serializePhoneInputValue(
    val: PhoneInputParts | string | null | undefined,
    originalValue: unknown,
): string {
    if (val == null || val === "") return "";
    if (typeof val === "string") return val;

    if (typeof val !== "object" || !("phoneNumber" in val)) {
        return String(val);
    }

    const countryCode = String(val.countryCode ?? "").replace(/\D/g, "");
    const areaCode = String(val.areaCode ?? "").replace(/\D/g, "");
    const phoneNum = String(val.phoneNumber ?? "").replace(/\D/g, "");

    if (!phoneNum && !areaCode && !countryCode) {
        return "";
    }

    const originalRaw =
        typeof originalValue === "string"
            ? originalValue.trim()
            : formatMobileForDisplay(originalValue).trim();
    const normalizedOriginal = formatMobileForDisplay(originalRaw).trim();
    const originalDigits = normalizedOriginal.replace(/\D/g, "");
    const originalHasPlus =
        normalizedOriginal.startsWith("+") || originalRaw.startsWith("+");
    const fullDigits = `${countryCode}${areaCode}${phoneNum}`;
    const withArea = `${areaCode}${phoneNum}`;

    if (countryCode && fullDigits) {
        return `+${fullDigits}`;
    }

    // Library sometimes omits countryCode mid-edit; only fall back to the
    // original international value when the user hasn't typed a new number yet.
    if (originalHasPlus && originalDigits && !phoneNum && !areaCode) {
        return normalizedOriginal.startsWith("+")
            ? normalizedOriginal
            : `+${originalDigits}`;
    }

    if (areaCode && withArea) {
        return withArea;
    }

    if (phoneNum) {
        return phoneNum;
    }

    return normalizedOriginal || originalRaw;
}

/**
 * Normalize a pasted phone string to E.164 when it includes a country code,
 * otherwise return digits only. Used to bypass antd-phone-input's country mask,
 * which truncates pasted digits that don't fit the currently selected mask
 * (commonly drops the last 1–2 digits when pasting an international number
 * while another country is selected).
 */
export function normalizePastedPhoneNumber(pasted: string): string {
    const trimmed = pasted.trim();
    if (!trimmed) return "";

    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return "";

    // Explicit + / 00 international prefix → keep full digit string as E.164.
    if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
        const intlDigits = trimmed.startsWith("00")
            ? digits.replace(/^00/, "")
            : digits;
        return intlDigits ? `+${intlDigits}` : "";
    }

    // Long enough to be country-code + national number (e.g. 905338773001).
    // Leading 0 = local trunk prefix (e.g. 0533…), not a country code — leave
    // digit-only so the active country mask can apply without truncation from
    // a bogus "+0…" parse.
    if (digits.length >= 11 && !digits.startsWith("0")) {
        return `+${digits}`;
    }

    return digits;
}

// --- Format Phone Number
interface PhoneInput {
    countryCode?: string;
    areaCode?: string;
    phoneNumber: string;
    isoCode?: string;
}

/**
 * Converts various phone number string formats into a readable, formatted phone number.
 * @param input - A JSON string of a PhoneInput object or a raw phone number string.
 * @returns A formatted phone number string.
 */
export function formatPhoneNumber(
    input: string | null | undefined = "",
): string {
    const cleanedInput = input?.trim();
    if (!cleanedInput) return "";

    // 1. Try to handle JSON string inputs
    if (cleanedInput.startsWith("{")) {
        try {
            const parsed: PhoneInput = JSON.parse(cleanedInput);
            const parts: string[] = [];

            if (parsed.countryCode) parts.push(`+${parsed.countryCode}`);
            if (parsed.areaCode) parts.push(`(${parsed.areaCode})`);

            // Format the local number part for readability (e.g., 877-3001)
            parts.push(formatRawNumber(parsed.phoneNumber));

            return parts.join(" ");
        } catch (e) {
            // If JSON parsing fails, fallback to treating it as a raw string
        }
    }

    // 2. Handle raw phone number strings (e.g., "0909090090")
    return formatRawNumber(cleanedInput);
}

/**
 * Helper to format a raw string of digits into a standard readable layout
 */
function formatRawNumber(numStr: string): string {
    // Remove all non-numeric characters
    const cleaned = numStr.replace(/\D/g, "");

    if (cleaned.length === 7) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    } else if (cleaned.length === 11) {
        return `+${cleaned.charAt(0)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    // Return original or cleaned if it doesn't match standard lengths
    return numStr;
}
// ---
