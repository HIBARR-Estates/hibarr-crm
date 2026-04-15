/**
 * Construction Project configuration constants.
 *
 * These mirror the PHP constants on DeveloperProject model
 * and provide Select/Checkbox options for the construction project form sections.
 */

// ================================================================
// Project-level Construction Status (different from property-level)
// ================================================================

export const PROJECT_CONSTRUCTION_STATUSES = [
    { value: "pre_construction", label: "Pre-construction Phase" },
    { value: "active_construction", label: "Active Construction" },
    { value: "post_construction", label: "Post Construction" },
    { value: "complete", label: "Complete" },
] as const;

// ================================================================
// Furniture Packages
// ================================================================

export const FURNITURE_PACKAGES = [
    { value: "unfurnished", label: "Unfurnished" },
    { value: "part_furnished", label: "Part Furnished" },
    { value: "white_goods_only", label: "White Goods Only" },
    { value: "fully_furnished", label: "Fully Furnished" },
] as const;

// ================================================================
// Unit Types (multi-select)
// ================================================================

export const UNIT_TYPE_OPTIONS = [
    { value: "apartment", label: "Apartment" },
    { value: "villa", label: "Villa" },
    { value: "semi_detached_villa", label: "Semi-Detached Villa" },
    { value: "bungalow", label: "Bungalow" },
    { value: "townhouse", label: "Townhouse" },
    { value: "shop", label: "Shop" },
    { value: "office", label: "Office" },
] as const;

// ================================================================
// Title Deed Types
// ================================================================

export const TITLE_DEED_TYPE_OPTIONS = [
    { value: "turkish", label: "Turkish" },
    { value: "british", label: "British" },
    { value: "exchange", label: "Exchange (Eşdeğer)" },
    { value: "tahsis", label: "Tahsis" },
    { value: "leasehold", label: "Leasehold" },
    { value: "mucahit", label: "Mücahit" },
] as const;

// ================================================================
// Primary Category Options (for multi-select on projects)
// ================================================================

export const PROJECT_PRIMARY_CATEGORY_OPTIONS = [
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
] as const;

// ================================================================
// Property-level Construction Status (existing, for reference)
// ================================================================

export const PROPERTY_CONSTRUCTION_STATUSES = [
    { value: "off_plan", label: "Off-Plan" },
    { value: "under_construction", label: "Under Construction" },
    { value: "completed_new", label: "Completed (New)" },
    { value: "resale", label: "Resale" },
    { value: "ruin_renovation", label: "Ruin (For Renovation)" },
] as const;

// ================================================================
// Distance Fields for manual entry
// ================================================================

export const DISTANCE_FIELDS = [
    { key: "market_km", label: "Nearest Market" },
    { key: "hospital_km", label: "Nearest Hospital" },
    { key: "airport_km", label: "Nearest Airport" },
    { key: "school_km", label: "Nearest School" },
    { key: "beach_km", label: "Nearest Beach" },
    { key: "sea_km", label: "Nearest Sea" },
] as const;

// ================================================================
// Downpayment type options
// ================================================================

export const DOWNPAYMENT_TYPE_OPTIONS = [
    { value: "percentage", label: "Percentage (%)" },
    { value: "amount", label: "Fixed Amount" },
] as const;
