import { useCallback, useRef, useState } from "react";
import axios from "axios";
import type { PartnerLeadDetail } from "../types";

/**
 * One lead's detail for the modal. Fetched on open and kept per id, so
 * reopening a lead the partner has already looked at is instant.
 */
export default function usePartnerLeadDetail() {
    const cache = useRef(new Map<number, PartnerLeadDetail>());
    const [detail, setDetail] = useState<PartnerLeadDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const open = useCallback(async (id: number) => {
        setError(false);

        const cached = cache.current.get(id);
        if (cached) {
            setDetail(cached);
            return;
        }

        setDetail(null);
        setLoading(true);
        try {
            const response = await axios.get(route("partner.leads.show", id));
            const data = response.data.data as PartnerLeadDetail;
            cache.current.set(id, data);
            setDetail(data);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    const close = useCallback(() => {
        setDetail(null);
        setError(false);
    }, []);

    return { detail, loading, error, open, close };
}
