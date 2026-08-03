import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import type { DealItineraryFormInput } from "@/Pages/Deals/Redesign/hooks/useDealItinerary";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

/**
 * Create / update / delete flight legs from the lead page, patching
 * LeadWorkspaceContext.deals (and lead.lead_flight_itineraries when present).
 */
export default function useLeadItineraryMutations() {
    const { t } = useTranslation();
    const { setDeals, setLead } = useLeadWorkspace();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const patchDealLegs = useCallback(
        (
            dealId: number | null | undefined,
            updater: (legs: ILeadFlightItinerary[]) => ILeadFlightItinerary[],
        ) => {
            if (dealId != null) {
                setDeals((prev) =>
                    prev.map((deal) =>
                        deal.id === dealId
                            ? {
                                  ...deal,
                                  lead_flight_itineraries: updater(
                                      deal.lead_flight_itineraries ?? [],
                                  ),
                              }
                            : deal,
                    ),
                );
            }

            setLead((prev) => {
                const existing = prev.lead_flight_itineraries;
                if (!existing) return prev;
                return {
                    ...prev,
                    lead_flight_itineraries: updater(existing),
                };
            });
        },
        [setDeals, setLead],
    );

    const { mutate: createMutate, status: createStatus } = useApiMutate<
        DealItineraryFormInput & { deal_id: number; status: string },
        ILeadFlightItinerary,
        ApiResponse<ILeadFlightItinerary>
    >(route("lead-flight-itineraries.store"), "POST");

    const createLeg = useCallback(
        (
            dealId: number,
            input: DealItineraryFormInput,
            onSuccess?: () => void,
        ) => {
            createMutate(
                {
                    ...input,
                    deal_id: dealId,
                    status:
                        input.direction === FlightDirection.ARRIVAL
                            ? "not arrived"
                            : "not departed",
                },
                {
                    onSuccess: (response) => {
                        if (!isSuccessResponse(response) || !response.data) {
                            router.reload({
                                only: ["deal", "deals", "lead"],
                                onSuccess: () => onSuccess?.(),
                            });
                            return;
                        }

                        const created = {
                            ...response.data,
                            deal_id: response.data.deal_id ?? dealId,
                        };
                        patchDealLegs(dealId, (legs) => {
                            if (
                                created.id &&
                                legs.some((leg) => leg.id === created.id)
                            ) {
                                return legs;
                            }
                            return [...legs, created];
                        });
                        onSuccess?.();
                    },
                },
            );
        },
        [createMutate, patchDealLegs],
    );

    const updateLeg = useCallback(
        (
            leg: ILeadFlightItinerary,
            input: DealItineraryFormInput,
            onSuccess?: () => void,
        ) => {
            const legId = leg.id as number;
            const status =
                leg.direction === input.direction
                    ? leg.status
                    : input.direction === FlightDirection.ARRIVAL
                      ? "not arrived"
                      : "not departed";

            setIsUpdating(true);
            router.put(
                route("lead-flight-itineraries.update", legId),
                { ...input, status },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        message.success(
                            t(
                                "pages.deals.workspace.itinerary.messages.updated",
                            ),
                        );
                        patchDealLegs(leg.deal_id, (legs) =>
                            legs.map((item) =>
                                item.id === legId
                                    ? { ...item, ...input, status }
                                    : item,
                            ),
                        );
                        onSuccess?.();
                    },
                    onError: () => {
                        message.error(
                            t(
                                "pages.deals.workspace.itinerary.messages.update_failed",
                            ),
                        );
                    },
                    onFinish: () => setIsUpdating(false),
                },
            );
        },
        [patchDealLegs, t],
    );

    const deleteLeg = useCallback(
        (leg: ILeadFlightItinerary, onSuccess?: () => void) => {
            const legId = leg.id as number;
            setDeletingId(legId);

            let snapshotByDeal: ILeadFlightItinerary[] | null = null;
            let snapshotOnLead: ILeadFlightItinerary[] | null = null;

            setDeals((prev) =>
                prev.map((deal) => {
                    if (deal.id !== leg.deal_id) return deal;
                    snapshotByDeal = deal.lead_flight_itineraries ?? [];
                    return {
                        ...deal,
                        lead_flight_itineraries: snapshotByDeal.filter(
                            (item) => item.id !== legId,
                        ),
                    };
                }),
            );
            setLead((prev) => {
                if (!prev.lead_flight_itineraries) return prev;
                snapshotOnLead = prev.lead_flight_itineraries;
                return {
                    ...prev,
                    lead_flight_itineraries: snapshotOnLead.filter(
                        (item) => item.id !== legId,
                    ),
                };
            });

            router.delete(route("lead-flight-itineraries.destroy", legId), {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    message.success(
                        t("pages.deals.workspace.itinerary.messages.deleted"),
                    );
                    onSuccess?.();
                },
                onError: () => {
                    message.error(
                        t(
                            "pages.deals.workspace.itinerary.messages.delete_failed",
                        ),
                    );
                    if (snapshotByDeal && leg.deal_id != null) {
                        setDeals((prev) =>
                            prev.map((deal) =>
                                deal.id === leg.deal_id
                                    ? {
                                          ...deal,
                                          lead_flight_itineraries: snapshotByDeal!,
                                      }
                                    : deal,
                            ),
                        );
                    }
                    if (snapshotOnLead) {
                        setLead((prev) => ({
                            ...prev,
                            lead_flight_itineraries: snapshotOnLead!,
                        }));
                    }
                },
                onFinish: () => setDeletingId(null),
            });
        },
        [setDeals, setLead, t],
    );

    return {
        createLeg,
        isCreating: isLoading({ status: createStatus }),
        updateLeg,
        isUpdating,
        deleteLeg,
        deletingId,
    };
}
