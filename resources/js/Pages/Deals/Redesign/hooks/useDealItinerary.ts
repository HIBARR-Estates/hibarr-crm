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
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealItineraryFormInput {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    flight_date: string;
    is_transfer_required: boolean;
    ticket_image_url?: string | null;
}

export default function useDealItinerary(dealId: number) {
    const { t } = useTranslation();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const { deal, setDeal } = useDealWorkspace();

    const { mutate: createMutate, status: createStatus } = useApiMutate<
        DealItineraryFormInput & { deal_id: number; status: string },
        ILeadFlightItinerary,
        ApiResponse<ILeadFlightItinerary>
    >(route("lead-flight-itineraries.store"), "POST");

    const appendLeg = useCallback(
        (created: ILeadFlightItinerary) => {
            setDeal((prev) => {
                const existing = prev.lead_flight_itineraries ?? [];
                if (created.id && existing.some((leg) => leg.id === created.id)) {
                    return prev;
                }
                return {
                    ...prev,
                    lead_flight_itineraries: [...existing, created],
                };
            });
        },
        [setDeal],
    );

    const createLeg = useCallback(
        (input: DealItineraryFormInput, onSuccess?: () => void) => {
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
                            // Fallback: refresh whichever page prop carries
                            // itineraries (Deal show → deal, Lead show → deals).
                            router.reload({
                                only: ["deal", "deals"],
                                onSuccess: () => onSuccess?.(),
                            });
                            return;
                        }

                        appendLeg(response.data);
                        onSuccess?.();
                    },
                },
            );
        },
        [appendLeg, createMutate, dealId],
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
                {
                    ...input,
                    status,
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        message.success(
                            t(
                                "pages.deals.workspace.itinerary.messages.updated",
                            ),
                        );
                        setDeal((prev) => ({
                            ...prev,
                            lead_flight_itineraries: (
                                prev.lead_flight_itineraries ?? []
                            ).map((item) =>
                                item.id === legId
                                    ? { ...item, ...input, status }
                                    : item,
                            ),
                        }));
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
        [setDeal, t],
    );

    const deleteLeg = useCallback(
        (legId: number, onSuccess?: () => void) => {
            setDeletingId(legId);
            const snapshot = deal.lead_flight_itineraries ?? [];
            setDeal((prev) => ({
                ...prev,
                lead_flight_itineraries: (
                    prev.lead_flight_itineraries ?? []
                ).filter((leg) => leg.id !== legId),
            }));
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
                    setDeal((prev) => ({
                        ...prev,
                        lead_flight_itineraries: snapshot,
                    }));
                },
                onFinish: () => setDeletingId(null),
            });
        },
        [deal.lead_flight_itineraries, setDeal, t],
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
