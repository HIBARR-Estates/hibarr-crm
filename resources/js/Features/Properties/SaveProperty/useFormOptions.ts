/**
 * Central hook that derives all dropdown/select options from enumValues
 * (the single source of truth from the database).
 *
 * Converts LookupValue[] ({name, label}) into Ant Design-compatible
 * {value, label}[] format. Handles category-based filtering for property
 * types and sale types.
 */
import { useMemo } from "react";
import type { PropertyEnumValues, LookupValue, PrimaryCategory } from "@/Types";

export interface SelectOption {
    value: string;
    label: string;
}

/**
 * Convert a LookupValue[] array to Ant Design select options.
 * Maps {name, label} → {value: name, label}.
 */
export function toSelectOptions(
    items: LookupValue[] | undefined,
): SelectOption[] {
    if (!items?.length) return [];
    return items.map((item) => ({ value: item.name, label: item.label }));
}

/**
 * Convert a LookupValue[] to a simple string[] of names.
 * Useful for checkbox groups that use plain string values.
 */
export function toNameList(items: LookupValue[] | undefined): string[] {
    if (!items?.length) return [];
    return items.map((item) => item.name);
}

/**
 * Convert a LookupValue[] to label strings for display-only checkbox groups.
 * Returns [{value: label, label: label}] for components that store human-readable values.
 */
export function toLabelOptions(
    items: LookupValue[] | undefined,
): SelectOption[] {
    if (!items?.length) return [];
    return items.map((item) => ({ value: item.label, label: item.label }));
}

interface FormOptions {
    /** Property types filtered by the selected primary category */
    propertyTypeOptions: SelectOption[];
    /** Sale types (land only gets "For Sale") */
    saleTypeOptions: SelectOption[];
    /** All statuses */
    statusOptions: SelectOption[];
    /** Construction statuses */
    constructionStatusOptions: SelectOption[];
    /** View types */
    viewTypeOptions: SelectOption[];
    /** Occupancy types */
    occupancyTypeOptions: SelectOption[];
    /** Cities */
    cityOptions: SelectOption[];
    /** Title deed types */
    deedTypeOptions: SelectOption[];
    /** Deed statuses */
    deedStatusOptions: SelectOption[];
    /** Unit styles / sub-types */
    unitStyleOptions: SelectOption[];
    /** Furniture statuses */
    furnitureStatusOptions: SelectOption[];
    /** Heating types */
    heatingTypeOptions: SelectOption[];
    /** Floor types */
    floorTypeOptions: SelectOption[];
    /** Interior features (label-based for checkbox groups) */
    interiorFeatureOptions: SelectOption[];
    /** Exterior features (label-based for checkbox groups) */
    exteriorFeatureOptions: SelectOption[];
    /** Location features (label-based for checkbox groups) */
    locationFeatureOptions: SelectOption[];
    /** Add-on options (label-based for checkbox groups) */
    addOnOptions: SelectOption[];
}

/**
 * Hook that computes all form dropdown options from enumValues.
 *
 * @param enumValues  The enum values from the backend (via Inertia page props)
 * @param primaryCategory  The currently selected primary category
 */
export function useFormOptions(
    enumValues: PropertyEnumValues | undefined,
    primaryCategory: PrimaryCategory | null,
): FormOptions {
    return useMemo(() => {
        if (!enumValues) {
            return {
                propertyTypeOptions: [],
                saleTypeOptions: [],
                statusOptions: [],
                constructionStatusOptions: [],
                viewTypeOptions: [],
                occupancyTypeOptions: [],
                cityOptions: [],
                deedTypeOptions: [],
                deedStatusOptions: [],
                unitStyleOptions: [],
                furnitureStatusOptions: [],
                heatingTypeOptions: [],
                floorTypeOptions: [],
                interiorFeatureOptions: [],
                exteriorFeatureOptions: [],
                locationFeatureOptions: [],
                addOnOptions: [],
            };
        }

        // Property types filtered by category from the DB-driven grouped data
        let filteredPropertyTypes: LookupValue[] = [];
        if (
            primaryCategory &&
            enumValues.property_types_by_category?.[primaryCategory]
        ) {
            filteredPropertyTypes =
                enumValues.property_types_by_category[primaryCategory];
        } else {
            // No category selected — show all property types
            filteredPropertyTypes = enumValues.property_types ?? [];
        }

        // Sale types: land only gets "For Sale"
        let filteredSaleTypes = enumValues.sale_types ?? [];
        if (primaryCategory === "land") {
            filteredSaleTypes = filteredSaleTypes.filter(
                (st) => st.name === "For Sale",
            );
        }

        return {
            propertyTypeOptions: toSelectOptions(filteredPropertyTypes),
            saleTypeOptions: toSelectOptions(filteredSaleTypes),
            statusOptions: toSelectOptions(enumValues.statuses),
            constructionStatusOptions: toSelectOptions(
                enumValues.construction_statuses,
            ),
            viewTypeOptions: toSelectOptions(enumValues.view_types),
            occupancyTypeOptions: toSelectOptions(enumValues.occupancy_types),
            cityOptions: toSelectOptions(enumValues.cities),
            deedTypeOptions: toSelectOptions(enumValues.deed_types),
            deedStatusOptions: toSelectOptions(enumValues.deed_statuses),
            unitStyleOptions: toSelectOptions(enumValues.unit_styles),
            furnitureStatusOptions: toSelectOptions(
                enumValues.furniture_statuses,
            ),
            heatingTypeOptions: toSelectOptions(enumValues.heating_types),
            floorTypeOptions: toSelectOptions(enumValues.floor_types),
            interiorFeatureOptions: toLabelOptions(enumValues.inside_features),
            exteriorFeatureOptions: toLabelOptions(enumValues.outside_features),
            locationFeatureOptions: toLabelOptions(
                enumValues.location_features,
            ),
            addOnOptions: toLabelOptions(enumValues.add_ons),
        };
    }, [enumValues, primaryCategory]);
}
