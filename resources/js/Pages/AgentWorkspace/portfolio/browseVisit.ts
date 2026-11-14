import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import type { BrowseFilters } from "./types";

/** Properties shown per page of Browse; "Show more" adds this many. */
export const STEP = 24;

/** Browse filters, search and "Show more" are partial visits that keep the page. */
export function visitBrowse(next: BrowseFilters, nextLimit = STEP): void {
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(next)) if (value) data[key] = value;
    if (nextLimit > STEP) data.limit = String(nextLimit);
    router.get(route("agent.portfolio.browse"), data, {
        preserveState: true,
        preserveScroll: true,
        replace: true,
        only: ["properties", "filters", "limit"],
    });
}

/** The search text of Browse, applied 300 ms after the last keystroke. */
export function useBrowseSearch(filters: BrowseFilters, enabled: boolean) {
    const [text, setText] = useState(filters.search ?? "");
    const debounce = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled || text === (filters.search ?? "")) return;
        debounce.current = window.setTimeout(() => visitBrowse({ ...filters, search: text }), 300);
        return () => {
            if (debounce.current) window.clearTimeout(debounce.current);
        };
    }, [text, filters, enabled]);

    return { text, setText };
}
