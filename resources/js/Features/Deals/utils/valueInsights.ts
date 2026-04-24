import type { Deal } from "@/Types/api/deals";

type Source = "manual" | "calculated";

export interface DealValueInsight {
    source: Source;
    sourceLabel: string;
    finalValue: number;
    manualValue: number | null;
    calculatedValue: number | null;
    baseTotal: number | null;
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

    const derivedBaseTotal =
        uniqueProductOriginals.size > 0
            ? Array.from(uniqueProductOriginals.values()).reduce(
                  (sum, amount) => sum + amount,
                  0,
              )
            : null;

    const derivedDiscountTotal = applications.reduce((sum, application) => {
        const discount = toNumber(application.discount_amount);

        return sum + (discount ?? 0);
    }, 0);

    const fallbackDiscount = toNumber(deal.total_discount) ?? 0;
    const discountTotal =
        derivedDiscountTotal > 0 ? derivedDiscountTotal : fallbackDiscount;

    const manualValue =
        toNumber(deal.manual_value) ??
        (source === "manual" ? toNumber(deal.value) : null);

    const persistedCalculatedValue = toNumber(deal.calculated_value);
    const calculatedValue =
        persistedCalculatedValue ??
        (derivedBaseTotal !== null
            ? Math.max(0, derivedBaseTotal - discountTotal)
            : null);

    const baseTotal =
        derivedBaseTotal ??
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
        discountTotal,
        deltaVsManual,
        status,
        isLocked: !!deal.is_locked,
    };
};
