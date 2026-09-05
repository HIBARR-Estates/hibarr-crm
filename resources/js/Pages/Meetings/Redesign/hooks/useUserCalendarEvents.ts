import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { companyTimeDayjsFormat } from "@/lib/companyDateTime";

/** Types `MyCalendarController` can return. */
export type UserCalendarEventType =
    | "task"
    | "event"
    | "ticket"
    | "leave"
    | "follow_up";

/** FullCalendar-shaped row as `/account/my-calendar` returns it. */
export interface UserCalendarEvent {
    id: string | number;
    title: string | null;
    start: string | null;
    end: string | null;
    event_type: UserCalendarEventType;
    extendedProps?: {
        bg_color?: string | null;
        color?: string | null;
        icon?: string | null;
        name?: string | null;
    };
}

/**
 * The signed-in user's other commitments for a month — tasks, company events,
 * tickets and approved leave — from the calendar endpoint the legacy My
 * Calendar page already uses, so per-type `view_*` permissions are enforced
 * server-side exactly as they are there.
 *
 * `follow_up` rows are dropped: that branch matches only meetings whose lead
 * agent is the viewer (missing deal-linked and participant-only ones) and
 * titles them from a `Lead->name` that doesn't exist, so it comes back blank.
 * The Meetings page has its own visibility-scoped meeting query for that.
 */
export default function useUserCalendarEvents(month: string, enabled: boolean) {
    const [events, setEvents] = useState<UserCalendarEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;

        const monthStart = dayjs(`${month}-01`);
        if (!monthStart.isValid()) return undefined;

        // A slower earlier month must not overwrite a newer one.
        let cancelled = false;
        setLoading(true);

        const params = new URLSearchParams({
            start: monthStart.format("YYYY-MM-DD"),
            end: monthStart.endOf("month").format("YYYY-MM-DD"),
            type: "all",
        });

        fetch(`/account/my-calendar?${params.toString()}`, {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((response) => (response.ok ? response.json() : []))
            .then((json) => {
                if (cancelled) return;
                setEvents(
                    Array.isArray(json)
                        ? (json as UserCalendarEvent[]).filter(
                              (event) => event.event_type !== "follow_up",
                          )
                        : [],
                );
            })
            .catch(() => {
                // The month grid is still useful with meetings alone — a failed
                // overlay shouldn't blank the calendar or raise an error toast.
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

/**
 * Day cell an overlay event belongs in. These rows are already localized (or
 * plain dates) server-side, so they're read as wall-clock rather than
 * converted again. A task is shown on its due date rather than spanning every
 * day from start to due, which would bury the month in duplicate chips.
 */
export function userEventDayKey(event: UserCalendarEvent): string | null {
    const value =
        event.event_type === "task" ? (event.end ?? event.start) : event.start;
    if (!value) return null;
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

/** Whether the row carries a meaningful clock time, or is date-level only. */
export function userEventHasTime(event: UserCalendarEvent): boolean {
    return event.event_type === "event" || event.event_type === "ticket";
}

/**
 * Clock time for a row that has one. Formatted as wall-clock rather than
 * through `useUserDateTime` — these values arrive already localized and
 * offset-less, so converting them again would shift every one of them.
 */
export function userEventTimeLabel(event: UserCalendarEvent): string {
    if (!event.start) return "";
    const parsed = dayjs(event.start);
    return parsed.isValid() ? parsed.format(companyTimeDayjsFormat()) : "";
}
