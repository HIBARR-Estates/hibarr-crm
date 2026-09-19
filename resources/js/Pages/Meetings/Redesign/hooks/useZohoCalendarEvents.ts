import { useEffect, useState } from "react";
import dayjs from "dayjs";
import type { UserCalendarEvent } from "./useUserCalendarEvents";

/**
 * The signed-in user's own Zoho Calendar events for a month.
 *
 * Returned in the same shape as the `/account/my-calendar` overlay rows, so
 * the month grid renders a Zoho event exactly the way it renders a task or a
 * company event — one overlay, one chip design, one set of toggles.
 *
 * Failures resolve to an empty list rather than an error: the calendar's
 * subject is the CRM's own meetings, and an unreachable third-party calendar
 * should quietly contribute nothing instead of interrupting the page.
 */
export default function useZohoCalendarEvents(month: string, enabled: boolean) {
    const [events, setEvents] = useState<UserCalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) {
            setEvents([]);
            return undefined;
        }

        if (!dayjs(`${month}-01`).isValid()) return undefined;

        // A slower earlier month must not overwrite a newer one.
        let cancelled = false;
        setLoading(true);

        fetch(route("meetings.zoho_events", { month }), {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((json) => {
                if (cancelled) return;
                setEvents(
                    Array.isArray(json?.data)
                        ? (json.data as UserCalendarEvent[])
                        : [],
                );
            })
            .catch(() => {
                if (!cancelled) setEvents([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [month, enabled]);

    return { events, loading };
}
