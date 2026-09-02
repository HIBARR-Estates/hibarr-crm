import { usePage } from "@inertiajs/react";

export const DEAL_EXPOSES_FLAG = "crm.deal-exposes-tab";

/**
 * crm.deal-exposes-tab — gates the Exposes tab on both the Deal and the Lead
 * workspace. Globally shared via Inertia's featureFlags prop (see
 * HandleInertiaRequests), so this reads the same way from either page.
 * Mirrors useExposeShareLinksFlag.
 */
export default function useDealExposesFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[DEAL_EXPOSES_FLAG] === true;
}
