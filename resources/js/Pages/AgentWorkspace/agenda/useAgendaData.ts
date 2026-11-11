import { useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { TodaySchedule } from "../today/types";
import { addDays, rangeFor, rangeOf, shiftDate, type AgendaRange, type AgendaView } from "./range";

/** Meetings and pending tasks for a span of days (AgentWorkspaceController::agenda). */
export type AgendaData = TodaySchedule;

const AGENDA_KEY = "agent-agenda";

/** A range's data, tagged with the days it covers. */
type AgendaPayload = AgendaData & { from: string; to: string };

function fetchAgenda(from: string, to: string): Promise<AgendaPayload> {
    return axios
        .get<AgendaData>(route("agent.today.agenda"), { params: { from, to } })
        .then((response) => ({ ...response.data, from, to }));
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
        // Keep the last range on screen while the next loads, but only when it
        // has the same shape: a week's data in a month grid would mislead.
        placeholderData: (previous?: AgendaPayload) =>
            previous && (rangeOf(previous.from, previous.to).days.length > 7) === (range.days.length > 7) ? previous : undefined,
    });

    const data = query.data;
    const dataRange: AgendaRange =
        data && (data.from !== range.from || data.to !== range.to) ? rangeOf(data.from, data.to) : range;

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
        /** The days the view asked for: titles and navigation use these. */
        range,
        /** The days `data` covers, which trail `range` while a new range loads. */
        dataRange,
        data,
        /** False while an older range stands in for the one asked for. */
        current: !query.isPlaceholderData,
        /** True only before anything has loaded for this view. */
        loading: query.isPending,
        /** A newer range is on its way while an older one is shown. */
        updating: query.isFetching && query.isPlaceholderData,
        failed: query.isError && !query.data,
        retry: query.refetch,
        refresh,
    };
}

/**
 * Meetings and open tasks for a few days after `today`, for Today's "Next
 * days" chips. Shares the agenda's cache, so opening the agenda after it
 * paints at once.
 */
export function useUpcomingDays(today: string, days: number) {
    const from = addDays(today, 1);
    const to = addDays(today, days);
    return useQuery({ ...queryFor(from, to), staleTime: 5 * 60_000 }).data;
}

