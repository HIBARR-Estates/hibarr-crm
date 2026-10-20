import { useCallback, useRef, useState } from "react";
import axios from "axios";
import type { PartnerLeadDetail } from "../types";

/**
 * One lead's detail for the modal. Fetched on open and kept per id, so
 * reopening a lead the partner has already looked at is instant.
 *
 * Only the lead currently asked for may touch the modal's state: a slow
 * response for a lead the partner has since closed (or swapped for another)
 * is cached but never shown, and never clears the newer request's spinner.
 */
export default function usePartnerLeadDetail() {
    const cache = useRef(new Map<number, PartnerLeadDetail>());
    const requested = useRef<number | null>(null);
    const [detail, setDetail] = useState<PartnerLeadDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const open = useCallback(async (id: number) => {
        requested.current = id;
        setError(false);

        const cached = cache.current.get(id);
        if (cached) {
            setDetail(cached);
            setLoading(false);
            return;
        }

        setDetail(null);
        setLoading(true);
        try {
            const response = await axios.get(route("partner.leads.show", id));
            const data = response.data?.data as PartnerLeadDetail | undefined;
            // An empty or malformed body is a failure, not a blank modal.
            if (!data || !Array.isArray(data.active_deals)) {
                throw new Error("Unexpected lead response");
            }
            cache.current.set(id, data);
            if (requested.current === id) setDetail(data);
        } catch {
            if (requested.current === id) setError(true);
        } finally {
            if (requested.current === id) setLoading(false);
        }
    }, []);

    const close = useCallback(() => {
        requested.current = null;
        setDetail(null);
        setError(false);
        setLoading(false);
    }, []);

    return { detail, loading, error, open, close };
}
