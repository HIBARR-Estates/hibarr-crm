import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type { ReportPage, ReportRange, ReportWindow } from "./types";

interface State<T> {
    rows: T[];
    page: number;
    lastPage: number;
    total: number;
    loading: boolean;
    failed: boolean;
}

const PER_PAGE = 15;

const empty = <T,>(): State<T> => ({ rows: [], page: 0, lastPage: 1, total: 0, loading: true, failed: false });

/**
 * One of the classic Agent Reports lists for the period, asked for this
 * agent. A list is fetched the first time its tab is shown for a period and
 * kept after that; "Show more" appends the next page.
 */
export default function useReportList<T>(endpoint: string, window: ReportWindow, agentId: number | null, enabled: boolean) {
    const [cache, setCache] = useState<Record<string, State<T>>>({});
    const key = `${endpoint}|${window.start}|${window.end}`;
    const started = useRef(new Set<string>());

    const load = useCallback(
        (cacheKey: string, page: number) => {
            setCache((current) => ({ ...current, [cacheKey]: { ...(current[cacheKey] ?? empty<T>()), loading: true, failed: false } }));
            axios
                .get<ReportPage<T>>(endpoint, {
                    params: {
                        start_date: window.start,
                        end_date: window.end,
                        view_type: "agent",
                        per_page: PER_PAGE,
                        page,
                        ...(agentId ? { agent_id: agentId } : {}),
                    },
                })
                .then((response) => {
                    const body = response.data;
                    setCache((current) => {
                        const before = current[cacheKey];
                        return {
                            ...current,
                            [cacheKey]: {
                                rows: page === 1 || !before ? body.data : [...before.rows, ...body.data],
                                page: body.current_page,
                                lastPage: body.last_page,
                                total: body.total,
                                loading: false,
                                failed: false,
                            },
                        };
                    });
                })
                .catch(() => {
                    started.current.delete(`${cacheKey}|${page}`);
                    setCache((current) => ({ ...current, [cacheKey]: { ...(current[cacheKey] ?? empty<T>()), loading: false, failed: true } }));
                });
        },
        [endpoint, window.start, window.end, agentId],
    );

    useEffect(() => {
        if (!enabled || started.current.has(`${key}|1`)) return;
        started.current.add(`${key}|1`);
        load(key, 1);
    }, [enabled, key, load]);

    const state = cache[key] ?? empty<T>();
    const more = useCallback(() => {
        const next = state.page + 1;
        if (state.loading || next > state.lastPage || started.current.has(`${key}|${next}`)) return;
        started.current.add(`${key}|${next}`);
        load(key, next);
    }, [key, load, state.lastPage, state.loading, state.page]);
    const retry = useCallback(() => {
        const next = Math.max(1, state.page + 1);
        started.current.add(`${key}|${next}`);
        load(key, state.page === 0 ? 1 : next);
    }, [key, load, state.page]);

    return { ...state, more, retry, hasMore: state.page > 0 && state.page < state.lastPage };
}

export type { ReportRange };
