import { useEffect, useState } from "react";
import axios from "axios";
import type { MarketingLeadOptions } from "./types";

// Kept for the page's lifetime: reopening the modal paints at once.
let cached: MarketingLeadOptions | null = null;
let inflight: Promise<MarketingLeadOptions> | null = null;

function load(): Promise<MarketingLeadOptions> {
    if (cached) return Promise.resolve(cached);
    inflight ??= axios
        .get(route("marketing-leads.options"), { headers: { Accept: "application/json" } })
        .then((res) => {
            cached = res.data as MarketingLeadOptions;
            return cached;
        })
        .finally(() => {
            inflight = null;
        });
    return inflight;
}

/**
 * Pick lists and custom field definitions for the modal, loaded the first
 * time it opens (in the background; the contact step renders meanwhile).
 */
export default function useMarketingLeadOptions(open: boolean) {
    const [options, setOptions] = useState<MarketingLeadOptions | null>(cached);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!open || options) return;
        let active = true;
        setFailed(false);
        load()
            .then((data) => active && setOptions(data))
            .catch(() => active && setFailed(true));
        return () => {
            active = false;
        };
    }, [open, options]);

    return { options, loading: open && !options && !failed, failed, retry: () => setFailed(false) };
}
