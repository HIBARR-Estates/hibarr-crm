import { useCallback, useState } from "react";
import { router } from "@inertiajs/react";
import { message } from "antd";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { FlightDirection, ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";

export interface DealItineraryCreateInput {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    flight_date: string;
    is_transfer_required: boolean;
}

export default function useDealItinerary(dealId: number) {
    const [deletingId, setDeletingId] = useState<number | null>(null);

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
                    onSuccess: () => {
                        message.success("Flight added to itinerary");
                        onSuccess?.();
                        router.reload({ only: ["deal"] });
                    },
                },
            );
        },
        [createMutate, dealId],
    );

    const deleteLeg = useCallback((legId: number, onSuccess?: () => void) => {
        setDeletingId(legId);
        router.delete(route("lead-flight-itineraries.destroy", legId), {
            preserveScroll: true,
            onSuccess: () => {
                message.success("Flight deleted");
                onSuccess?.();
            },
            onFinish: () => setDeletingId(null),
        });
    }, []);

    return {
        createLeg,
        isCreating: isLoading({ status: createStatus }),
        deleteLeg,
        deletingId,
    };
}
