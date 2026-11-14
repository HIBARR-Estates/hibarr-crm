import { useEffect, useState } from "react";
import axios from "axios";
import type { AuditLogEntry, AuditLogFilters, AuditLogMeta } from "../types";

const EMPTY_META: AuditLogMeta = { current_page: 1, last_page: 1, per_page: 25, total: 0 };

/**
 * Paginated, filtered fetch against `audit-log.entries`. Runs on mount and on
 * every filter change, outside the Inertia prop bundle, so the page paints
 * before any rows load. A newer request always wins over a slower older one.
 *
 * `search` is passed in separately so the caller can debounce it.
 */
export default function useAuditLogEntries(filters: AuditLogFilters, search: string, refreshKey: number) {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [meta, setMeta] = useState<AuditLogMeta>(EMPTY_META);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const { users, events, types, sources, recordId, dateFrom, dateTo, page, perPage } = filters;
    const key = JSON.stringify([users, events, types, sources, recordId.trim(), search.trim(), dateFrom, dateTo, page, perPage, refreshKey]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError(false);

        axios
            .get(route("audit-log.entries"), {
                signal: controller.signal,
                headers: { Accept: "application/json" },
                params: {
                    users: users.length ? users : undefined,
                    events: events.length ? events : undefined,
                    types: types.length ? types : undefined,
                    sources: sources.length ? sources : undefined,
                    record_id: recordId.trim() || undefined,
                    search: search.trim() || undefined,
                    date_from: dateFrom || undefined,
                    date_to: dateTo || undefined,
                    page,
                    per_page: perPage,
                },
            })
            .then((res) => {
                setEntries(res.data?.data ?? []);
                setMeta(res.data?.meta ?? EMPTY_META);
                setLoading(false);
            })
            .catch((err) => {
                if (axios.isCancel(err)) return;
                setEntries([]);
                setMeta(EMPTY_META);
                setError(true);
                setLoading(false);
            });

        return () => controller.abort();
        // `key` captures every input above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return { entries, meta, loading, error };
}
