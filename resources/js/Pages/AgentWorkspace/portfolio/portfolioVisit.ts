import { useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";

type Params = Record<string, string | undefined>;

/**
 * Browse and Projects filters, search and paging are partial visits that keep
 * the page: only the cards, the applied filters and the options come back.
 */
export function visitList(routeName: "agent.portfolio.browse" | "agent.portfolio.projects", filters: Params, page = 1): void {
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) if (value) data[key] = value;
    if (page > 1) data.page = String(page);
    router.get(route(routeName), data, {
        preserveState: true,
        preserveScroll: false,
        replace: true,
        only: routeName === "agent.portfolio.browse" ? ["properties", "filters"] : ["projects", "filters"],
    });
}

/** The search text of Browse or Projects, applied 300 ms after the last keystroke. */
export function useListSearchVisit(routeName: "agent.portfolio.browse" | "agent.portfolio.projects", filters: Params, enabled: boolean) {
    const [text, setText] = useState(filters.search ?? "");
    const debounce = useRef<number | null>(null);

    useEffect(() => {
        if (!enabled || text === (filters.search ?? "")) return;
        debounce.current = window.setTimeout(() => visitList(routeName, { ...filters, search: text }), 300);
        return () => {
            if (debounce.current) window.clearTimeout(debounce.current);
        };
    }, [text, filters, enabled, routeName]);

    return { text, setText };
}

/** Filters that make up the Filters pill's count: the search is on the page, a multi-select is one filter. */
export function filterCount(filters: Params): number {
    return Object.entries(filters).filter(([key, value]) => key !== "search" && key !== "page" && value !== undefined && value !== "").length;
}
