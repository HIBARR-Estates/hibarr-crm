import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { DEFAULT_PER_PAGE } from "../config/auditLogEvents";
import type { AuditEvent, AuditLogFilters, AuditSource } from "../types";

const EMPTY_FILTERS: AuditLogFilters = {
    users: [],
    events: [],
    types: [],
    sources: [],
    recordId: "",
    search: "",
    dateFrom: "",
    dateTo: "",
    page: 1,
    perPage: DEFAULT_PER_PAGE,
};

const list = (params: URLSearchParams, key: string): string[] =>
    (params.get(key) ?? "").split(",").map((v) => v.trim()).filter(Boolean);

function readFromUrl(): AuditLogFilters {
    if (typeof window === "undefined") return EMPTY_FILTERS;
    const params = new URLSearchParams(window.location.search);
    const page = Number(params.get("page"));
    const perPage = Number(params.get("per_page"));
    return {
        users: list(params, "users").map(Number).filter((n) => Number.isInteger(n) && n >= 0),
        events: list(params, "events") as AuditEvent[],
        types: list(params, "types"),
        sources: list(params, "sources") as AuditSource[],
        recordId: params.get("record") ?? "",
        search: params.get("q") ?? "",
        dateFrom: params.get("from") ?? "",
        dateTo: params.get("to") ?? "",
        page: Number.isInteger(page) && page > 0 ? page : 1,
        perPage: Number.isInteger(perPage) && perPage > 0 && perPage <= 100 ? perPage : DEFAULT_PER_PAGE,
    };
}

function writeToUrl(filters: AuditLogFilters) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const set = (key: string, value: string) => {
        if (value) url.searchParams.set(key, value);
        else url.searchParams.delete(key);
    };
    set("users", filters.users.join(","));
    set("events", filters.events.join(","));
    set("types", filters.types.join(","));
    set("sources", filters.sources.join(","));
    set("record", filters.recordId.trim());
    set("q", filters.search.trim());
    set("from", filters.dateFrom);
    set("to", filters.dateTo);
    set("page", filters.page > 1 ? String(filters.page) : "");
    set("per_page", filters.perPage !== DEFAULT_PER_PAGE ? String(filters.perPage) : "");
    if (url.toString() !== window.location.href) {
        window.history.replaceState(window.history.state, "", url.toString());
    }
}

/**
 * Audit log filter state — client-side and URL-synced via
 * history.replaceState, so a filtered view is shareable and survives a
 * refresh without any Inertia visit.
 *
 * Re-stamps the URL after every Inertia request finishes: the deferred
 * filter-options request otherwise resets the address bar to the URL it was
 * dispatched from, dropping filters picked while it was in flight.
 */
export default function useAuditLogFilters() {
    const [filters, setFilters] = useState<AuditLogFilters>(readFromUrl);
    const filtersRef = useRef(filters);

    useEffect(() => {
        filtersRef.current = filters;
        writeToUrl(filters);
    }, [filters]);

    useEffect(() => router.on("finish", () => writeToUrl(filtersRef.current)), []);

    /** Changing any filter returns to the first page. */
    const update = useCallback((patch: Partial<Omit<AuditLogFilters, "page">>) => {
        setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
    }, []);

    const setPage = useCallback((page: number) => {
        setFilters((prev) => ({ ...prev, page }));
    }, []);

    const reset = useCallback(() => {
        setFilters((prev) => ({ ...EMPTY_FILTERS, perPage: prev.perPage }));
    }, []);

    const activeCount =
        (filters.users.length ? 1 : 0) +
        (filters.events.length ? 1 : 0) +
        (filters.types.length ? 1 : 0) +
        (filters.sources.length ? 1 : 0) +
        (filters.recordId.trim() ? 1 : 0) +
        (filters.search.trim() ? 1 : 0) +
        (filters.dateFrom ? 1 : 0) +
        (filters.dateTo ? 1 : 0);

    return { filters, update, setPage, reset, activeCount };
}
