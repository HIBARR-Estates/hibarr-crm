/**
 * Category-driven field configuration for the Property form.
 *
 * Defines which sections and fields are visible for each primary_category.
 *
 * ALL dropdown option values are now sourced from the database via enumValues
 * (single source of truth). This file only contains:
 *   - Section/field visibility rules per category
 *   - Numeric range generators (bedrooms 0-8, bathrooms 1-5, etc.)
 *   - Static UI-only options (rental periods, payment intervals)
 */
import type { PrimaryCategory } from "@/Types";

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
    documents: boolean;
    photos: boolean;
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
        documents: true,
        photos: true,
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
        documents: true,
        photos: true,
        descriptionMedia: true,
        ownerInfo: true,
        internalInfo: true,
    },
    land: {
        coreDetails: true,
        pricing: true,
        specifications: true, // limited: only plot size, no rooms
        location: true,
        classification: false, // No classification for land
        features: false, // No interior/exterior for land
        legalFinancial: true,
        documents: true, // Land-only documents checklist
        photos: true,
        descriptionMedia: true,
        ownerInfo: true,
        internalInfo: true,
    },
    construction_project: {
        coreDetails: false, // Replaced by construction-specific sections
        pricing: false, // Uses starting_price in its own section
        specifications: false,
        location: true, // Reuses LocationSection (without block/unit)
        classification: false,
        features: false,
        legalFinancial: false,
        documents: false,
        photos: false, // Uses project-level photos section
        descriptionMedia: false,
        ownerInfo: false,
        internalInfo: false,
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
        rooms: false,
        floorNumber: true,
        floorsInBuilding: true,
        buildingAge: true,
        grossArea: true,
        usableArea: true,
        plotSize: false,
        balconyArea: true,
        elevator: false,
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
        elevator: false,
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
    construction_project: {
        bedrooms: false,
        bathrooms: false,
        livingRoom: false,
        rooms: false,
        floorNumber: false,
        floorsInBuilding: false,
        buildingAge: false,
        grossArea: false,
        usableArea: false,
        plotSize: false,
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
