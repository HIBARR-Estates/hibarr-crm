import { useEffect, useState } from "react";
import axios from "axios";
import type { MarketingLeadOptions } from "./types";

// Kept for the page's lifetime: reopening the modal paints at once.
let cached: MarketingLeadOptions | null = null;
let inflight: Promise<MarketingLeadOptions> | null = null;
// Bumped on invalidation so a request started before it can't write the old
// options (e.g. the previous default owner) back into the cache.
let generation = 0;

/** Drops the cached options, e.g. after Lead settings change the default owner. */
export function invalidateMarketingLeadOptions(): void {
    generation++;
    cached = null;
    inflight = null;
}

function load(): Promise<MarketingLeadOptions> {
    if (cached) return Promise.resolve(cached);
    if (inflight) return inflight;
    const started = generation;
    const request = axios
        .get(route("marketing-leads.options"), { headers: { Accept: "application/json" } })
        .then((res) => {
            const data = res.data as MarketingLeadOptions;
            if (started === generation) cached = data;
            return data;
        })
        .finally(() => {
            if (inflight === request) inflight = null;
        });
    inflight = request;
    return request;
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
