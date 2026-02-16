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
    { value: "trnc_allocation", label: "TRNC Allocation (Tahsis/TMD)" },
    { value: "leasehold", label: "Leasehold (Vakıf/Ministry)" },
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
// Project Facilities (34 items — checkboxes)
// ================================================================

export interface FacilityOption {
    value: string;
    label: string;
}

export const PROJECT_FACILITIES: FacilityOption[] = [
    { value: "gym", label: "Gym" },
    { value: "hamam", label: "Hamam" },
    { value: "sauna", label: "Sauna" },
    { value: "massage_spa", label: "Massage and Spa" },
    { value: "indoor_pool", label: "Indoor Pool" },
    { value: "outdoor_pool", label: "Outdoor Pool" },
    { value: "heated_indoor_pool", label: "Heated Indoor Pool" },
    { value: "kids_playground", label: "Kids Playground" },
    { value: "aquapark", label: "Aquapark" },
    { value: "mini_zoo", label: "Mini Zoo" },
    { value: "clinics", label: "Clinics" },
    { value: "restaurant", label: "Restaurant" },
    { value: "beauty_center", label: "Beauty Center" },
    { value: "walking_paths", label: "Walking Paths" },
    { value: "cycling_routes", label: "Cycling Routes" },
    { value: "hiking_routes", label: "Hiking Routes" },
    { value: "dentist", label: "Dentist" },
    { value: "healing_yoga", label: "Healing/Yoga" },
    { value: "tennis_court", label: "Tennis Court" },
    { value: "basketball_court", label: "Basketball Court" },
    { value: "reception", label: "Reception" },
    { value: "security_24_7", label: "24/7 Security" },
    { value: "beach", label: "Beach" },
    { value: "beach_cinema", label: "Beach Cinema" },
    { value: "cinema", label: "Cinema" },
    { value: "casino", label: "Casino" },
    { value: "jacuzzi", label: "Jacuzzi" },
    { value: "gated_community", label: "Gated Community" },
    { value: "football_court", label: "Football Court" },
    { value: "volleyball_court", label: "Volleyball Court" },
    { value: "supermarket", label: "Supermarket" },
    { value: "cafe", label: "Cafe" },
    { value: "bar", label: "Bar" },
    { value: "car_park", label: "Car Park" },
    { value: "cleaning_service", label: "Cleaning Service" },
    { value: "central_generator", label: "Central Generator" },
    { value: "on_site_management", label: "On-site Management" },
];

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
