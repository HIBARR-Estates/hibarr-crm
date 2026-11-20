import { useMemo } from "react";
import { useApiQuery } from "@/lib/api/client";

export type CalendlyTarget = { type: "lead" | "deal"; id: number };

/** A booking page the signed-in user may offer, already filled in for the record. */
export interface CalendlyLinkOption {
    id: number;
    name: string;
    description: string | null;
    url: string;
    /** The contact's name/email are already on the link (false for a deal with no lead). */
    prefilled: boolean;
}

interface CalendlyLinksResponse {
    status: string;
    data: { links: CalendlyLinkOption[] };
}

const NONE: CalendlyLinkOption[] = [];

/**
 * The Calendly booking pages the schedule-meeting modal offers for one lead or
 * deal. The server has already narrowed them to the user's roles and filled in
 * the contact's details and the chosen guests, so the modal only shows what it
 * is given. Loads in the background once the modal is open: nothing waits on
 * it, and the modal looks exactly as before until (and unless) it returns links.
 *
 * Changing `guestIds` asks for the links again with that guest list; the
 * previous links stay on screen meanwhile, and `refreshing` says they are
 * about to be replaced, so a stale link isn't opened by mistake.
 */
export default function useCalendlyLinks(
    target: CalendlyTarget | null | undefined,
    enabled: boolean,
    guestIds: number[],
) {
    const { data, isLoading, isPlaceholderData } = useApiQuery<
        CalendlyLinksResponse,
        { record_type: string; record_id: number; guest_ids: string }
    >({
        path: route("meetings.calendly_links"),
        params: target
            ? {
                  record_type: target.type,
                  record_id: target.id,
                  // Always sent, even when empty: absent means "just me".
                  guest_ids: guestIds.join(","),
              }
            : undefined,
        options: {
            enabled: enabled && Boolean(target),
            staleTime: 60_000,
            // A failure here must never get in the way of scheduling by hand.
            retry: false,
            keepPreviousData: true,
        },
    });

    const links = useMemo(() => data?.data?.links ?? NONE, [data]);

    return { links, loading: isLoading, refreshing: isPlaceholderData };
}
