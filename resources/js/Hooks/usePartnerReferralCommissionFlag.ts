import { usePage } from "@inertiajs/react";

export const PARTNER_REFERRAL_COMMISSION_FLAG = "crm.partner-referral-commission";

/**
 * crm.partner-referral-commission — gates a partner's referral share of the
 * commission pool on the pages that show or edit it. Globally shared via
 * Inertia's featureFlags prop (see HandleInertiaRequests). Mirrors
 * useDealValueCommissionFlag. The deal panel and the partner profile are
 * already gated server-side, so they need no check here.
 */
export default function usePartnerReferralCommissionFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[PARTNER_REFERRAL_COMMISSION_FLAG] === true;
}
