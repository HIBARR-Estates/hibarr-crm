/**
 * Unit Type configuration constants.
 *
 * These mirror the PHP constants on DeveloperProjectUnitType model
 * and provide Select/Checkbox/Radio options for the unit type form.
 */

// ================================================================
// Primary Category (radio)
// ================================================================

export const PRIMARY_CATEGORY_OPTIONS = [
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
] as const;

// ================================================================
// Property Types (by category)
// ================================================================

export const RESIDENTIAL_PROPERTY_TYPES = [
    { value: "apartment", label: "Apartment" },
    { value: "villa", label: "Villa" },
    { value: "semi_detached_villa", label: "Semi-Detached Villa" },
    { value: "bungalow", label: "Bungalow" },
    { value: "townhouse", label: "Townhouse" },
] as const;

export const COMMERCIAL_PROPERTY_TYPES = [
    { value: "shop", label: "Shop" },
    { value: "office", label: "Office" },
] as const;

/**
 * Get property types based on the selected primary category.
 */
export function getPropertyTypesForCategory(
    category: "residential" | "commercial" | null,
) {
    if (category === "residential") return [...RESIDENTIAL_PROPERTY_TYPES];
    if (category === "commercial") return [...COMMERCIAL_PROPERTY_TYPES];
    return [];
}

// ================================================================
// Unit Styles (multi-select, residential only)
// ================================================================

export const UNIT_STYLE_OPTIONS = [
    { value: "studio", label: "Studio" },
    { value: "penthouse", label: "Penthouse" },
    { value: "loft", label: "Loft" },
    { value: "garden_apartment", label: "Garden Apartment" },
    { value: "duplex", label: "Duplex" },
    { value: "triplex", label: "Triplex" },
] as const;

// ================================================================
// View Types (multi-select)
// ================================================================

export const VIEW_TYPE_OPTIONS = [
    { value: "sea_front", label: "Sea Front (Direct)" },
    { value: "sea_view", label: "Sea View" },
    { value: "mountain_view", label: "Mountain View" },
    { value: "pool_view", label: "Pool View" },
    { value: "garden_view", label: "Garden View" },
    { value: "city_view", label: "City View" },
] as const;

// ================================================================
// Furniture Status (select)
// ================================================================

export const FURNITURE_STATUS_OPTIONS = [
    { value: "unfurnished", label: "Unfurnished" },
    { value: "part_furnished", label: "Part Furnished" },
    { value: "white_goods_only", label: "White Goods Only" },
    { value: "fully_furnished", label: "Fully Furnished" },
] as const;

// ================================================================
// Currency (select, with symbol)
// ================================================================

export const CURRENCY_OPTIONS = [
    { value: "EUR", label: "Euro (€)", symbol: "€" },
    { value: "GBP", label: "British Pound (£)", symbol: "£" },
    { value: "USD", label: "US Dollar ($)", symbol: "$" },
    { value: "TRY", label: "Turkish Lira (₺)", symbol: "₺" },
] as const;

/**
 * Get the symbol for a given currency code.
 */
export function getCurrencySymbol(code: string): string {
    const found = CURRENCY_OPTIONS.find((c) => c.value === code);
    return found ? found.symbol : code;
}

// ================================================================
// Bedroom Options (select)
// ================================================================

export const BEDROOM_OPTIONS = [
    { value: 0, label: "Studio (0)" },
    { value: 1, label: "1 Bedroom" },
    { value: 2, label: "2 Bedrooms" },
    { value: 3, label: "3 Bedrooms" },
    { value: 4, label: "4 Bedrooms" },
    { value: 5, label: "5 Bedrooms" },
    { value: 6, label: "6 Bedrooms" },
    { value: 7, label: "7 Bedrooms" },
    { value: 8, label: "8+ Bedrooms" },
] as const;

// ================================================================
// Bathroom Options (select)
// ================================================================

export const BATHROOM_OPTIONS = [
    { value: 1, label: "1 Bathroom" },
    { value: 2, label: "2 Bathrooms" },
    { value: 3, label: "3 Bathrooms" },
    { value: 4, label: "4 Bathrooms" },
    { value: 5, label: "5+ Bathrooms" },
] as const;

// ================================================================
// Floor Options (select)
// ================================================================

export const FLOOR_OPTIONS = [
    { value: "basement", label: "Basement (-1)" },
    { value: "ground", label: "Ground Floor (0)" },
    { value: "1", label: "1st Floor" },
    { value: "2", label: "2nd Floor" },
    { value: "3", label: "3rd Floor" },
    { value: "4", label: "4th Floor" },
    { value: "5", label: "5th Floor" },
    { value: "6", label: "6th Floor" },
    { value: "7", label: "7th Floor" },
    { value: "8", label: "8th Floor" },
    { value: "9", label: "9th Floor" },
    { value: "10", label: "10th Floor" },
    { value: "11", label: "11th Floor" },
    { value: "12", label: "12th Floor" },
    { value: "13", label: "13th Floor" },
    { value: "14", label: "14th Floor" },
    { value: "15+", label: "15th Floor+" },
] as const;

// ================================================================
// Floors In Building Options (select)
// ================================================================

export const FLOORS_IN_BUILDING_OPTIONS = Array.from(
    { length: 16 },
    (_, i) => ({
        value: i,
        label: i === 0 ? "Ground Only" : `${i} Floor${i > 1 ? "s" : ""}`,
    }),
);

// ================================================================
// Outside Features (12 items — checkboxes)
// ================================================================

export const OUTSIDE_FEATURE_OPTIONS = [
    { value: "barbeque", label: "Barbeque" },
    { value: "bounding_wall", label: "Bounding Wall" },
    { value: "double_glazing", label: "Double Glazing" },
    { value: "garage", label: "Garage" },
    { value: "garden", label: "Garden" },
    { value: "generator", label: "Generator" },
    { value: "lift", label: "Lift" },
    { value: "private_pool", label: "Private Pool" },
    { value: "terrace", label: "Terrace" },
    { value: "thermal_insulation", label: "Thermal Insulation" },
    { value: "water_tank", label: "Water Tank" },
    { value: "jacuzzi", label: "Jacuzzi" },
] as const;

// ================================================================
// Inside Features (18 items — checkboxes)
// ================================================================

export const INSIDE_FEATURE_OPTIONS = [
    { value: "air_condition", label: "Air Condition" },
    { value: "bath_tube", label: "Bath Tube" },
    { value: "blind", label: "Blind" },
    { value: "ceramic", label: "Ceramic" },
    { value: "closet", label: "Closet" },
    { value: "entryphone", label: "Entryphone" },
    { value: "fire_alarm", label: "Fire Alarm" },
    { value: "fireplace", label: "Fireplace" },
    { value: "laundry", label: "Laundry" },
    { value: "master_room_bath", label: "Master Room Bath" },
    { value: "panel_door", label: "Panel Door" },
    { value: "pantry", label: "Pantry" },
    { value: "parquet", label: "Parquet" },
    { value: "solar_electric", label: "Solar Electric" },
    { value: "steel_door", label: "Steel Door" },
    { value: "tv_infrastructure", label: "TV Infrastructure" },
    { value: "wallpaper", label: "Wallpaper" },
    { value: "water_booster", label: "Water Booster" },
] as const;

// ================================================================
// Asset Tags (for unit type photos)
// ================================================================

export const UNIT_TYPE_ASSET_TAGS = [
    { value: "cover", label: "Cover Photo" },
    { value: "interior", label: "Interior" },
    { value: "exterior", label: "Exterior" },
    { value: "floor-plan", label: "Floor Plan" },
    { value: "gallery", label: "Gallery" },
] as const;
