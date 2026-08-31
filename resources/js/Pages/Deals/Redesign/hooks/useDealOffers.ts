import { useQueryClient } from "@tanstack/react-query";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import type { DealOffersResponse } from "@/Types/api/offers";

/**
 * Applied offer discounts on a deal (property-linked DealOfferApplication
 * rows). Shared by tab visibility and the Offers tab body — one query, cached
 * via TanStack Query on `deals.offers.index`.
 */
export default function useDealOffers(dealId: number, enabled = true) {
    const indexPath = route("deals.offers.index", dealId);
    const queryClient = useQueryClient();

    const { data, isLoading, isFetching, isError, refetch } =
        useApiQuery<DealOffersResponse>({
            path: indexPath,
            options: {
                enabled,
                staleTime: 30_000,
                retry: false,
            },
        });

    // The endpoint removes every offer on the deal and returns no payload to
    // read back, so the post-delete state is known outright — write it to the
    // cache directly instead of firing a second request to reload it.
    const { mutate: removeAllOffers, isPending: isRemovingAllOffers } =
        useApiMutate<undefined, unknown, ApiResponse<unknown>>(
            route("deals.offers.remove", dealId),
            "DELETE",
            () => {
                queryClient.setQueryData(
                    [indexPath, undefined],
                    (current: DealOffersResponse | undefined) => ({
                        ...current,
                        applications: [],
                        total_discount: 0,
                    }),
                );
            },
        );

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
        removeAllOffers,
        isRemovingAllOffers,
    };
}
