import { useEffect, useState } from "react";

/** One row of the schedule dialog's lead search. */
export interface BookableLead {
    id: number;
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
    owner: string | null;
    /** Whether they can be reached by email / phone at all (any contact method). */
    has_email?: boolean;
    has_phone?: boolean;
}

/** Typing pauses this long before the search goes out. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Leads a meeting can be booked against, searched on the server as the user
 * types.
 *
 * The dialog used to be handed every schedulable lead up front and filter
 * them in the browser — unbounded, and with nothing but a name to tell two
 * clients apart. This asks for the few that match (name, company, email or
 * phone) and returns enough per row to choose between them. With nothing
 * typed it returns the most recently added, so the list is never empty
 * before the user has typed anything.
 */
export default function useBookableLeads(query: string, enabled: boolean) {
    const [leads, setLeads] = useState<BookableLead[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;

        // A slower earlier request must not replace a newer one's results.
        let cancelled = false;
        const term = query.trim();
        setLoading(true);

        const timer = window.setTimeout(
            () => {
                const params = new URLSearchParams({ q: term });
                fetch(`${route("meetings.leads.search")}?${params}`, {
                    headers: {
                        Accept: "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                })
                    .then(async (response) => {
                        if (!response.ok) {
                            throw new Error(`Request failed (${response.status})`);
                        }
                        return response.json();
                    })
                    .then((json) => {
                        if (cancelled) return;
                        const ok = Boolean(json?.success);
                        setLeads(ok ? (json.data as BookableLead[]) : []);
                        setFailed(!ok);
                    })
                    .catch(() => {
                        if (cancelled) return;
                        setLeads([]);
                        setFailed(true);
                    })
                    .finally(() => {
                        if (!cancelled) setLoading(false);
                    });
            },
            // The first, empty search has nothing to wait out.
            term === "" ? 0 : SEARCH_DEBOUNCE_MS,
        );

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [query, enabled]);

    return { leads, loading, failed };
}
