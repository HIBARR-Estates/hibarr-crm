import { useMemo } from "react";
import { useApiQuery } from "@/lib/api/client";

export type ScheduleMeetingType = {
    id: number;
    name: string;
    color?: string;
    is_active?: boolean;
};

/**
 * Resolves meeting types for orphan schedule flows. Pages that already ship
 * `meetingTypes` (Meetings index) pass them through; Dashboard and similar
 * surfaces omit them and we load the same index the legacy drawer used.
 */
export default function useMeetingTypesForSchedule(
    provided: ScheduleMeetingType[] | undefined,
    enabled: boolean,
): ScheduleMeetingType[] {
    const shouldFetch = enabled && provided === undefined;

    const { data } = useApiQuery<{ meeting_types: ScheduleMeetingType[] }>({
        path: route("meeting-types.index"),
        options: {
            enabled: shouldFetch,
            staleTime: 60_000,
        },
    });

    return useMemo(() => {
        if (provided !== undefined) {
            return provided;
        }
        return (data?.meeting_types ?? []).filter(
            (type) => type.is_active !== false,
        );
    }, [provided, data?.meeting_types]);
}
