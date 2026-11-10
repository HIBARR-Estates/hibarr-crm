import { useCallback, useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { TodaySchedule } from "../today/types";
import { rangeFor, shiftDate, type AgendaView } from "./range";

/** Meetings and pending tasks for a span of days (AgentWorkspaceController::agenda). */
export type AgendaData = TodaySchedule;

const AGENDA_KEY = "agent-agenda";

function fetchAgenda(from: string, to: string): Promise<AgendaData> {
    return axios
        .get<AgendaData>(route("agent.today.agenda"), { params: { from, to } })
        .then((response) => response.data);
}

const queryFor = (from: string, to: string) => ({
    queryKey: [AGENDA_KEY, from, to],
    queryFn: () => fetchAgenda(from, to),
    staleTime: 60_000,
});

/**
 * The agenda's data for one view and date, cached per range.
 *
 * The previous range stays on screen while the next one loads, and the ranges
 * either side are fetched once this one lands, so stepping back or forward
 * shows cached data at once and refreshes it quietly.
 */
export default function useAgendaData(view: AgendaView, date: string, enabled: boolean) {
    const queryClient = useQueryClient();
    const range = rangeFor(view, date);

    const query = useQuery({
        ...queryFor(range.from, range.to),
        enabled,
        placeholderData: keepPreviousData,
    });

    const landed = query.isSuccess && !query.isPlaceholderData;
    useEffect(() => {
        if (!enabled || !landed) return;
        for (const direction of [-1, 1] as const) {
            const next = rangeFor(view, shiftDate(view, date, direction));
            void queryClient.prefetchQuery(queryFor(next.from, next.to));
        }
    }, [enabled, landed, view, date, queryClient]);

    /** Re-reads every cached range in the background, after a change was saved. */
    const refresh = useCallback(
        () => queryClient.invalidateQueries({ queryKey: [AGENDA_KEY] }),
        [queryClient],
    );

    return {
        range,
        data: query.data,
        /** True only before anything has loaded for this view. */
        loading: query.isPending,
        /** A newer range is on its way while an older one is shown. */
        updating: query.isFetching && query.isPlaceholderData,
        failed: query.isError && !query.data,
        retry: query.refetch,
        refresh,
    };
}
