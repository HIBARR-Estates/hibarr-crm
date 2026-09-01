import { useApiQuery } from "@/lib/api/client";
import type { DealOffersResponse } from "@/Types/api/offers";

/**
 * Applied offer discounts on a deal (property-linked DealOfferApplication
 * rows). Shared by tab visibility and the Offers tab body — one query, cached
 * via TanStack Query on `deals.offers.index`.
 */
export default function useDealOffers(dealId: number, enabled = true) {
    const { data, isLoading, isFetching, isError, refetch } =
        useApiQuery<DealOffersResponse>({
            path: route("deals.offers.index", dealId),
            options: {
                enabled,
                staleTime: 30_000,
                retry: false,
            },
        });

    const applications = data?.applications ?? [];

    return {
        applications,
        totalDiscount: data?.total_discount ?? 0,
        isLoading,
        isFetching,
        // Only meaningful once loading has settled — a failed request must
        // read as "couldn't load", never as "no offers applied".
        isError,
        hasOffers: applications.length > 0,
        refetch,
    };
}
