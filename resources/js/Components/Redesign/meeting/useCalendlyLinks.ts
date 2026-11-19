import { useMemo } from "react";
import { useApiQuery } from "@/lib/api/client";

export type CalendlyTarget = { type: "lead" | "deal"; id: number };

/** A booking page the signed-in user may offer, already filled in for the record. */
export interface CalendlyLinkOption {
    id: number;
    name: string;
    description: string | null;
    url: string;
}

interface CalendlyLinksResponse {
    status: string;
    data: { links: CalendlyLinkOption[] };
}

const NONE: CalendlyLinkOption[] = [];

/**
 * The Calendly booking pages the schedule-meeting modal offers for one lead or
 * deal. The server has already narrowed them to the user's roles and filled in
 * the person's details, so the modal only shows what it is given. Loads in the
 * background once the modal is open: nothing waits on it, and the modal looks
 * exactly as before until (and unless) it returns links.
 */
export default function useCalendlyLinks(
    target: CalendlyTarget | null | undefined,
    enabled: boolean,
) {
    const { data, isLoading } = useApiQuery<
        CalendlyLinksResponse,
        { record_type: string; record_id: number }
    >({
        path: route("meetings.calendly_links"),
        params: target
            ? { record_type: target.type, record_id: target.id }
            : undefined,
        options: {
            enabled: enabled && Boolean(target),
            staleTime: 60_000,
            // A failure here must never get in the way of scheduling by hand.
            retry: false,
        },
    });

    const links = useMemo(() => data?.data?.links ?? NONE, [data]);

    return { links, loading: isLoading };
}
