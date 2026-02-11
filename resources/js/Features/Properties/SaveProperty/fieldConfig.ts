/**
 * Category-driven field configuration for the Property form.
 *
 * Defines which sections and fields are visible for each primary_category,
 * replacing hardcoded arrays spread across multiple step components.
 */
import type { PrimaryCategory } from "@/Types";

// ================================================================
// Property type options filtered by category
// ================================================================

export const PROPERTY_TYPES_BY_CATEGORY: Record<PrimaryCategory, string[]> = {
    residential: [
        "Villa",
        "Twin Villa",
        "Apartment",
        "Family Home",
        "Townhouse",
        "Loft",
        "Penthouse",
        "Bungalow",
        "Block of apartments",
        "Complete Building",
        "Abandoned Building",
        "Residence",
        "Half Construction",
        "Time Share",
    ],
    commercial: [
        "Shop",
        "Hotel",
        "Business",
        "Warehouse",
        "Workplace",
        "Office",
        "Commercial Property",
    ],
    land: [
        "Residentially Zoned Land",
        "Field",
        "Residentially and Commercially Zoned Land",
        "Commercially Zoned Land",
        "Industrially Zoned land",
        "Tourism Zoned Land",
        "Olive Grove",
    ],
};

// ================================================================
// Sale type options
// ================================================================

export const ALL_SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
export const SALE_ONLY_TYPES = ["For Sale"];

export const getSaleTypesForCategory = (
    category: PrimaryCategory | null,
): string[] => {
    if (category === "land") return SALE_ONLY_TYPES;
    return ALL_SALE_TYPES;
};

// ================================================================
// Status options
// ================================================================

export const STATUS_OPTIONS = [
    "Available",
    "Reserved",
    "Sold",
    "Rented",
    "Withdrawn",
];

// ================================================================
// Construction status options
// ================================================================

export const CONSTRUCTION_STATUS_OPTIONS = [
    { value: "off_plan", label: "Off-Plan" },
    { value: "under_construction", label: "Under Construction" },
    { value: "completed_new", label: "Completed (New)" },
    { value: "resale", label: "Resale" },
    { value: "ruin_renovation", label: "Ruin (For Renovation)" },
];

// ================================================================
// Title deed type options
// ================================================================

export const TITLE_DEED_TYPE_OPTIONS = [
    { value: "turkish_british", label: "Turkish/British" },
    { value: "exchange", label: "Exchange (Eşdeğer)" },
    { value: "trnc_allocation", label: "TRNC Allocation (Tahsis/TMD)" },
    { value: "leasehold", label: "Leasehold (Vakıf/Ministry)" },
    { value: "mujahit", label: "Mücahit" },
];

// ================================================================
// View types
// ================================================================

export const VIEW_TYPE_OPTIONS = [
    { value: "sea_front", label: "Sea Front (Direct)" },
    { value: "sea_view", label: "Sea View" },
    { value: "mountain_view", label: "Mountain View" },
    { value: "pool_view", label: "Pool View" },
    { value: "garden_view", label: "Garden View" },
    { value: "city_view", label: "City View" },
];

// ================================================================
// Feature lists
// ================================================================

export const INTERIOR_FEATURES = [
    "Air Conditioning",
    "Central Heating",
    "Underfloor Heating",
    "Fireplace",
    "Elevator",
    "Smart Home System",
    "Alarm System",
    "Satellite TV",
    "Internet",
    "Built-in Kitchen",
    "Dishwasher",
    "Washing Machine",
    "Dryer",
    "Water Heater",
    "Solar Panels",
    "Jacuzzi",
    "Sauna",
    "Storage Room",
    "Dressing Room",
    "En-suite Bathroom",
    "Guest Toilet",
    "Laundry Room",
    "Double Glazing",
    "Blinds/Shutters",
    "Walk-in Closet",
];

export const EXTERIOR_FEATURES = [
    "Swimming Pool",
    "Private Pool",
    "Shared Pool",
    "Garden",
    "Private Garden",
    "Shared Garden",
    "Terrace",
    "Balcony",
    "Parking",
    "Covered Parking",
    "Garage",
    "Gym",
    "Tennis Court",
    "Basketball Court",
    "Children's Playground",
    "Security",
    "24/7 Security",
    "CCTV",
    "Gated Community",
    "BBQ Area",
    "Communal Pool",
    "Concierge",
    "Generator",
    "Water Tank",
    "Transformer",
    "Landscaping",
    "Sea Access",
    "Beach Access",
    "Wheelchair Access",
    "Pet Friendly",
    "Roof Terrace",
    "Caretaker",
];

export const LOCATION_FEATURES = [
    "Near Beach",
    "Near School",
    "Near Hospital",
    "Near Market",
    "Near Public Transport",
    "Near Mosque",
    "Near Restaurant",
    "Near Highway",
    "Near Airport",
    "City Center",
    "Quiet Area",
    "Rural Area",
    "Mountain Area",
    "Coastal Area",
    "Forest Area",
    "Nature View",
    "Walking Distance to Beach",
    "Near University",
    "Near Park",
    "Near Marina",
    "Near Golf Course",
    "Near Casino",
    "Near Shopping Mall",
];

export const ADD_ON_OPTIONS = [
    "Furniture Package",
    "White Goods Package",
    "Rental Management",
    "Maintenance Package",
    "Insurance",
    "Legal Support",
    "Title Deed Transfer Costs",
    "VAT Included",
    "Rental Guarantee",
    "Buy-Back Guarantee",
    "Payment Plan Available",
    "Crypto Payment Accepted",
    "Exchange Available",
    "Part Exchange Considered",
    "Company Name Transfer",
    "Investment Package",
];

// ================================================================
// Section visibility by category
// ================================================================

/** Which sections are visible for each primary category */
export interface CategorySections {
    coreDetails: boolean;
    pricing: boolean;
    specifications: boolean;
    location: boolean;
    classification: boolean;
    features: boolean;
    legalFinancial: boolean;
    descriptionMedia: boolean;
    ownerInfo: boolean;
    internalInfo: boolean;
}

export const CATEGORY_SECTIONS: Record<PrimaryCategory, CategorySections> = {
    residential: {
        coreDetails: true,
        pricing: true,
        specifications: true,
        location: true,
        classification: true,
        features: true,
        legalFinancial: true,
        descriptionMedia: true,
        ownerInfo: true,
        internalInfo: true,
    },
    commercial: {
        coreDetails: true,
        pricing: true,
        specifications: true,
        location: true,
        classification: true,
        features: true,
        legalFinancial: true,
        descriptionMedia: true,
        ownerInfo: true,
        internalInfo: true,
    },
    land: {
        coreDetails: true,
        pricing: true,
        specifications: true, // limited: only plot size, no rooms
        location: true,
        classification: true,
        features: false, // No interior/exterior for land
        legalFinancial: true,
        descriptionMedia: true,
        ownerInfo: true,
        internalInfo: true,
    },
};

// ================================================================
// Field visibility within sections by category
// ================================================================

export interface SpecificationFields {
    bedrooms: boolean;
    bathrooms: boolean;
    livingRoom: boolean;
    rooms: boolean;
    floorNumber: boolean;
    floorsInBuilding: boolean;
    buildingAge: boolean;
    grossArea: boolean;
    usableArea: boolean;
    plotSize: boolean;
    balconyArea: boolean;
    elevator: boolean;
    furnitureStatus: boolean;
    heatingType: boolean;
    unitStyle: boolean;
}

export const SPECIFICATION_FIELDS: Record<
    PrimaryCategory,
    SpecificationFields
> = {
    residential: {
        bedrooms: true,
        bathrooms: true,
        livingRoom: true,
        rooms: true,
        floorNumber: true,
        floorsInBuilding: true,
        buildingAge: true,
        grossArea: true,
        usableArea: true,
        plotSize: false,
        balconyArea: true,
        elevator: true,
        furnitureStatus: true,
        heatingType: true,
        unitStyle: true,
    },
    commercial: {
        bedrooms: true,
        bathrooms: true,
        livingRoom: false,
        rooms: false,
        floorNumber: true,
        floorsInBuilding: true,
        buildingAge: true,
        grossArea: true,
        usableArea: true,
        plotSize: false,
        balconyArea: true,
        elevator: true,
        furnitureStatus: false,
        heatingType: false,
        unitStyle: false,
    },
    land: {
        bedrooms: false,
        bathrooms: false,
        livingRoom: false,
        rooms: false,
        floorNumber: false,
        floorsInBuilding: false,
        buildingAge: false,
        grossArea: false,
        usableArea: false,
        plotSize: true,
        balconyArea: false,
        elevator: false,
        furnitureStatus: false,
        heatingType: false,
        unitStyle: false,
    },
};

// ================================================================
// Dropdown range generators
// ================================================================

export const BEDROOM_OPTIONS = Array.from({ length: 9 }, (_, i) => ({
    value: i,
    label: i === 0 ? "Studio / 0" : `${i}`,
}));

export const BATHROOM_OPTIONS = Array.from({ length: 5 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1}`,
}));

export const FLOOR_OPTIONS = [
    { value: -1, label: "Basement (-1)" },
    { value: 0, label: "Ground Floor (0)" },
    ...Array.from({ length: 16 }, (_, i) => ({
        value: i + 1,
        label: i === 15 ? "15+" : `${i + 1}`,
    })),
];

export const FLOORS_IN_BUILDING_OPTIONS = Array.from(
    { length: 17 },
    (_, i) => ({
        value: i,
        label: i === 16 ? "15+" : `${i}`,
    }),
);

export const BUILDING_AGE_OPTIONS = Array.from({ length: 17 }, (_, i) => ({
    value: i,
    label: i === 16 ? "15+" : `${i}`,
}));

export const FURNITURE_STATUS_OPTIONS = [
    { value: "Unfurnished", label: "Unfurnished" },
    { value: "Fully Furnished", label: "Fully Furnished" },
    { value: "Part Furnished", label: "Part Furnished" },
    { value: "White Goods Only", label: "White Goods Only" },
];

export const HEATING_TYPE_OPTIONS = [
    { value: "central", label: "Central Heating" },
    { value: "underfloor", label: "Underfloor Heating" },
    { value: "ac", label: "Air Conditioning" },
    { value: "stove", label: "Stove" },
    { value: "solar", label: "Solar" },
    { value: "none", label: "None" },
];

export const RENTAL_PERIOD_OPTIONS = [
    { value: 1, label: "1 Month" },
    { value: 3, label: "3 Months" },
    { value: 6, label: "6 Months" },
    { value: 12, label: "12 Months" },
    { value: 24, label: "24 Months" },
];

export const PAYMENT_INTERVAL_OPTIONS = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "biannual", label: "Bi-Annual" },
    { value: "annual", label: "Annual" },
    { value: "upfront", label: "Upfront" },
];

// ================================================================
// Unit style options
// ================================================================

export const UNIT_STYLE_OPTIONS = [
    { value: "standard", label: "Standard" },
    { value: "penthouse", label: "Penthouse" },
    { value: "loft", label: "Loft" },
    { value: "garden", label: "Garden Flat" },
    { value: "duplex", label: "Duplex" },
    { value: "triplex", label: "Triplex" },
    { value: "studio", label: "Studio" },
];
