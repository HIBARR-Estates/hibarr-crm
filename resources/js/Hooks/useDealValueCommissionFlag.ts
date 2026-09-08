import { usePage } from "@inertiajs/react";

export const DEAL_VALUE_COMMISSION_FLAG = "crm.deal-value-commission";

/**
 * crm.deal-value-commission — gates the commission split and revenue-to-company
 * rows on the deal value panel. Globally shared via Inertia's featureFlags
 * prop (see HandleInertiaRequests). Mirrors useDealFilesGroupingFlag.
 */
export default function useDealValueCommissionFlag(): boolean {
    const { props } = usePage();
    const featureFlags = props.featureFlags ?? {};

    return featureFlags[DEAL_VALUE_COMMISSION_FLAG] === true;
}
