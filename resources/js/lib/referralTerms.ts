export type ReferralTermsTranslate = (key: string, params?: Record<string, string | number>) => string;

/**
 * A partner's own referral terms, the ones that apply to a referred deal with no
 * package (per-package terms are set on the package), in words. Anything but a
 * percentage or fixed amount with a value reads as no terms.
 */
export function describeReferralTerms(
    t: ReferralTermsTranslate,
    type: string | null | undefined,
    value: string | number | null | undefined,
    currencySymbol: string,
): string {
    const number = value === null || value === undefined || value === "" ? null : Number(value);

    if ((type !== "percentage" && type !== "fixed") || number === null || Number.isNaN(number)) {
        return t("pages.agents.referral_commission_none");
    }

    if (type === "percentage") {
        return t("pages.agents.referral_commission_percentage_of_deal", { value: number });
    }

    return t("pages.agents.referral_commission_fixed_per_deal", {
        value: `${currencySymbol}${number.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    });
}
