import type { Deal } from "@/Types/api/deals";

type Source = "manual" | "calculated";

export interface DealValueInsight {
    source: Source;
    sourceLabel: string;
    finalValue: number;
    manualValue: number | null;
    calculatedValue: number | null;
    baseTotal: number | null;
    productsTotal: number | null;
    packagesTotal: number;
    grossTotal: number | null;
    discountTotal: number;
    deltaVsManual: number | null;
    status: "ok" | "no-offers" | "insufficient-data";
    isLocked: boolean;
}

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
};

export const getDealValueInsight = (deal: Deal): DealValueInsight => {
    const source: Source =
        deal.value_source === "calculated" ? "calculated" : "manual";
    const backendBreakdown = deal.value_breakdown;

    const applications = deal.offer_applications ?? [];
    const uniqueProductOriginals = new Map<number, number>();

    applications.forEach((application) => {
        const productId = Number(application.product_id);
        const originalAmount = toNumber(application.original_amount);

        if (!originalAmount || !productId) {
            return;
        }

        if (!uniqueProductOriginals.has(productId)) {
            uniqueProductOriginals.set(productId, originalAmount);
        }
    });

    const derivedProductsTotal =
        uniqueProductOriginals.size > 0
            ? Array.from(uniqueProductOriginals.values()).reduce(
                  (sum, amount) => sum + amount,
                  0,
              )
            : null;

    const packageTotals = (deal.packages ?? []).reduce((sum, pkg) => {
        const packageValue = toNumber(pkg?.value);
        return sum + (packageValue ?? 0);
    }, 0);

    const derivedDiscountTotal = applications.reduce((sum, application) => {
        const discount = toNumber(application.discount_amount);

        return sum + (discount ?? 0);
    }, 0);

    const fallbackDiscount =
        toNumber(backendBreakdown?.discount_total) ??
        toNumber(deal.total_discount) ??
        0;
    const discountTotal =
        derivedDiscountTotal > 0 ? derivedDiscountTotal : fallbackDiscount;

    const manualValue =
        toNumber(deal.manual_value) ??
        (source === "manual" ? toNumber(deal.value) : null);

    const persistedCalculatedValue = toNumber(deal.calculated_value);
    const backendCalculatedValue = toNumber(backendBreakdown?.calculated_value);
    const calculatedValue =
        backendCalculatedValue ??
        persistedCalculatedValue ??
        (derivedProductsTotal !== null
            ? Math.max(0, derivedProductsTotal + packageTotals - discountTotal)
            : null);

    const productsTotal =
        toNumber(backendBreakdown?.products_total) ?? derivedProductsTotal;
    const packagesTotal =
        toNumber(backendBreakdown?.packages_total) ?? packageTotals;
    const grossTotal =
        toNumber(backendBreakdown?.gross_total) ??
        (productsTotal !== null ? productsTotal + packagesTotal : null);

    const baseTotal =
        grossTotal ??
        (calculatedValue !== null ? calculatedValue + discountTotal : null);

    const finalValue =
        toNumber(deal.value) ??
        (source === "calculated"
            ? (calculatedValue ?? 0)
            : (manualValue ?? calculatedValue ?? 0));

    const deltaVsManual =
        manualValue !== null && calculatedValue !== null
            ? manualValue - calculatedValue
            : null;

    const status =
        baseTotal === null && calculatedValue === null
            ? "insufficient-data"
            : applications.length === 0
              ? "no-offers"
              : "ok";

    return {
        source,
        sourceLabel: source === "manual" ? "Manual" : "Calculated",
        finalValue,
        manualValue,
        calculatedValue,
        baseTotal,
        productsTotal,
        packagesTotal,
        grossTotal,
        discountTotal,
        deltaVsManual,
        status,
        isLocked: !!deal.is_locked,
    };
};
