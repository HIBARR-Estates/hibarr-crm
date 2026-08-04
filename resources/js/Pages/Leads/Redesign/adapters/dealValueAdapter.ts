/**
 * Property price wins over package default; neither → manual entry.
 * Ported from hibarr-playground lead-v2.jsx `deriveDealValue`.
 */
export interface DealValueCatalogItem {
    id: number | string;
    label: string;
    price?: number | string | null;
    defaultValue?: number | string | null;
}

export interface DerivedDealValue {
    value: number | string | null;
    source: "property" | "package" | "manual";
    label: string | null;
}

export function deriveDealValue(
    packageId: number | string | null | undefined,
    propertyId: number | string | null | undefined,
    packages: DealValueCatalogItem[],
    properties: DealValueCatalogItem[],
): DerivedDealValue {
    const property = properties.find(
        (p) => String(p.id) === String(propertyId ?? ""),
    );
    if (property && property.price != null && property.price !== "") {
        return {
            value: property.price,
            source: "property",
            label: property.label,
        };
    }

    const pkg = packages.find((p) => String(p.id) === String(packageId ?? ""));
    if (pkg && pkg.defaultValue != null && pkg.defaultValue !== "") {
        return {
            value: pkg.defaultValue,
            source: "package",
            label: pkg.label,
        };
    }

    return { value: null, source: "manual", label: null };
}
