import { useCallback, useState } from "react";

/**
 * Stub — itinerary create mutation for the Lead workspace Itinerary tab.
 * Replace with axios + context patch when the itinerary API is wired.
 */
export default function useLeadItineraryCreate(_leadId: number) {
    const [creating, setCreating] = useState(false);

    const createItinerary = useCallback(
        async (_input: Record<string, unknown>) => {
            setCreating(true);
            try {
                throw new Error("Itinerary create not implemented");
            } finally {
                setCreating(false);
            }
        },
        [],
    );

    return { createItinerary, creating };
}
