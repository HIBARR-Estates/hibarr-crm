import { useEffect, useState } from "react";
import axios from "axios";
import { RunLogEntry } from "../types";

export interface AutomationLogFilters {
    automationId?: number;
    status?: string;
    channel?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    /** Bump to force a refetch without changing any other filter. */
    refreshKey?: number;
}

interface LogsMeta {
    currentPage: number;
    lastPage: number;
    total: number;
}

const emptyMeta: LogsMeta = { currentPage: 1, lastPage: 1, total: 0 };

/** Paginated/filtered fetch against deal-automations.logs — fired on-demand
 * (mount / filter change), never blocking the page's own first paint since
 * it isn't part of the Inertia deferred-prop bundle. */
export default function useAutomationLogs(filters: AutomationLogFilters) {
    const [logs, setLogs] = useState<RunLogEntry[]>([]);
    const [meta, setMeta] = useState<LogsMeta | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        axios
            .get(route("deal-automations.logs"), {
                headers: { Accept: "application/json" },
                params: {
                    automation_id: filters.automationId,
                    status: filters.status,
                    channel: filters.channel,
                    date_from: filters.dateFrom,
                    date_to: filters.dateTo,
                    page: filters.page ?? 1,
                },
            })
            .then((res) => {
                if (cancelled) return;
                const paginated = res.data?.data;
                setLogs(paginated?.data ?? []);
                setMeta(
                    paginated
                        ? {
                              currentPage: paginated.current_page,
                              lastPage: paginated.last_page,
                              total: paginated.total,
                          }
                        : emptyMeta,
                );
            })
            .catch(() => {
                if (cancelled) return;
                setLogs([]);
                setMeta(emptyMeta);
                setError("failed");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [
        filters.automationId,
        filters.status,
        filters.channel,
        filters.dateFrom,
        filters.dateTo,
        filters.page,
        filters.refreshKey,
    ]);

    return { logs, meta, loading, error };
}
