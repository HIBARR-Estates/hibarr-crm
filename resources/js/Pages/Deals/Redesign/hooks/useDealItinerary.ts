import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";
import { FlightDirection, ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

export interface DealItineraryCreateInput {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    flight_date: string;
    is_transfer_required: boolean;
}

export default function useDealItinerary(dealId: number) {
    const { t } = useTranslation();
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const { deal, setDeal } = useDealWorkspace();

    const { mutate: createMutate, status: createStatus } = useApiMutate<
        DealItineraryCreateInput & { deal_id: number; status: string },
        ILeadFlightItinerary,
        ApiResponse<ILeadFlightItinerary>
    >(route("lead-flight-itineraries.store"), "POST");

    const createLeg = useCallback(
        (input: DealItineraryCreateInput, onSuccess?: () => void) => {
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
                        message.success(t("pages.deals.workspace.itinerary.messages.added"));
                        onSuccess?.();
                        // Patch the new leg into the deal locally (like every
                        // other section) so it appears instantly instead of
                        // waiting on a partial Inertia reload round-trip.
                        const created = response?.data;
                        if (created) {
                            setDeal((prev) => ({
                                ...prev,
                                lead_flight_itineraries: [
                                    ...(prev.lead_flight_itineraries ?? []),
                                    created,
                                ],
                            }));
                        } else {
                            router.reload({ only: ["deal"] });
                        }
                    },
                },
            );
        },
        [createMutate, dealId, setDeal, t],
    );

    const deleteLeg = useCallback(
        (legId: number, onSuccess?: () => void) => {
            setDeletingId(legId);
            // Optimistically drop the leg so it disappears instantly; restore
            // the previous list if the server rejects the delete.
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
                    message.success(t("pages.deals.workspace.itinerary.messages.deleted"));
                    onSuccess?.();
                },
                onError: () => {
                    message.error(t("pages.deals.workspace.itinerary.messages.delete_failed"));
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
        deleteLeg,
        deletingId,
    };
}
