import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { useDebounce } from "@/Hooks/useDebounce";
import type { PartnerLeadFilters } from "../types";

const EMPTY: PartnerLeadFilters = { search: null, status: null, stage: null, deals: null };

/** Drops empty values so the URL only carries filters that are actually set. */
function toQuery(filters: PartnerLeadFilters, page?: number) {
    const query: Record<string, string | number> = {};
    if (filters.search) query.search = filters.search;
    if (filters.status !== null) query.status = filters.status;
    if (filters.stage) query.stage = filters.stage;
    if (filters.deals) query.deals = filters.deals;
    if (page && page > 1) query.page = page;
    return query;
}

/**
 * The page's search and filters, kept in the URL: a change is a partial Inertia
 * reload of the leads only, so the controls never unmount and typing is not
 * interrupted. Search waits for a pause; the selects apply at once.
 */
export default function usePartnerLeadFilters(initial: PartnerLeadFilters) {
    const [filters, setFilters] = useState<PartnerLeadFilters>({ ...EMPTY, ...initial });
    const [searchText, setSearchText] = useState(initial.search ?? "");
    const [busy, setBusy] = useState(false);
    const debouncedSearch = useDebounce(searchText, 400);
    const applied = useRef(initial);

    const visit = useCallback((next: PartnerLeadFilters, page?: number) => {
        applied.current = next;
        router.get(route("partner.leads.index"), toQuery(next, page), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ["leads", "filters"],
            onStart: () => setBusy(true),
            onFinish: () => setBusy(false),
        });
    }, []);

    // Search: only once the partner pauses, and only if it actually changed.
    useEffect(() => {
        const next = debouncedSearch.trim() || null;
        if (next === (applied.current.search ?? null)) return;
        const updated = { ...filters, search: next };
        setFilters(updated);
        visit(updated);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    const setFilter = <K extends keyof PartnerLeadFilters>(key: K, value: PartnerLeadFilters[K]) => {
        const updated = { ...filters, [key]: value };
        setFilters(updated);
        visit(updated);
    };

    const clear = () => {
        setSearchText("");
        setFilters(EMPTY);
        visit(EMPTY);
    };

    const goToPage = (page: number) => visit(filters, page);

    const activeCount = [filters.search, filters.status, filters.stage, filters.deals].filter(
        (value) => value !== null && value !== "",
    ).length;

    return { filters, searchText, setSearchText, setFilter, clear, goToPage, activeCount, busy };
}
