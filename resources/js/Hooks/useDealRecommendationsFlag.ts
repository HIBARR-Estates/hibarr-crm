import { usePage } from "@inertiajs/react";

export const DEAL_RECOMMENDATIONS_FLAG = "crm.deal-recommendations-tab";

/**
 * crm.deal-recommendations-tab — gates the Recommendations tab on the deal
 * workspace. Globally shared via Inertia's featureFlags prop.
 */
export default function useDealRecommendationsFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[DEAL_RECOMMENDATIONS_FLAG] === true;
}
