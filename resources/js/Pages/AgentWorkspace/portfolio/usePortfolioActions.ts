import { useCallback, useState } from "react";
import axios from "axios";

type Outcome = { ok: true } | { ok: false; message: string };

function messageOf(error: unknown): string {
    if (axios.isAxiosError(error)) return error.response?.data?.message ?? error.message;
    return error instanceof Error ? error.message : "";
}

/**
 * The two things a card can do to a deal or a listing: attach it to a deal
 * (the deal page's own Properties endpoint) and ask its responsible agent
 * whether it is still available (the Availability requests endpoint). Both
 * report one outcome for the whole selection.
 */
export default function usePortfolioActions() {
    const [busy, setBusy] = useState<"assign" | "ask" | null>(null);

    const assign = useCallback(async (dealId: number, propertyIds: number[]): Promise<Outcome> => {
        setBusy("assign");
        try {
            for (const propertyId of propertyIds) {
                await axios.post(route("deals.properties.store", dealId), { property_id: propertyId });
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, message: messageOf(error) };
        } finally {
            setBusy(null);
        }
    }, []);

    const askAvailability = useCallback(async (propertyIds: number[]): Promise<Outcome> => {
        setBusy("ask");
        try {
            for (const propertyId of propertyIds) {
                await axios.post(route("availability-requests.store"), { property_id: propertyId });
            }
            return { ok: true };
        } catch (error) {
            return { ok: false, message: messageOf(error) };
        } finally {
            setBusy(null);
        }
    }, []);

    return { busy, assign, askAvailability };
}
