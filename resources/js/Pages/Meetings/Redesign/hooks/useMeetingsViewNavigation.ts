import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { router } from "@inertiajs/react";
import type { MeetingsViewMode } from "../adapters/meetingViewModel";
import type { UserCalendarEventType } from "./useUserCalendarEvents";

/**
 * A cookie rather than localStorage because the *server* needs it: the month
 * grid is only prepared for the calendar, so which view this browser opens on
 * has to be known before the first response, not after the page has run.
 */
const VIEW_COOKIE = "hibarr_meetings_view";
/** Where the view was remembered before the improvements (list by default). */
const LEGACY_VIEW_STORAGE_KEY = "hibarr_meetings_view";
const OVERLAY_STORAGE_KEY = "hibarr_meetings_calendar_overlay_types";

/** Everything the overlay can show, on by default. */
const ALL_OVERLAY_TYPES: UserCalendarEventType[] = [
    "task",
    "event",
    "ticket",
    "leave",
    "zoho",
];

function initialOverlayTypes(): UserCalendarEventType[] {
    if (typeof window === "undefined") return ALL_OVERLAY_TYPES;
    try {
        const stored = localStorage.getItem(OVERLAY_STORAGE_KEY);
        if (stored === null) return ALL_OVERLAY_TYPES;
        const parsed: unknown = JSON.parse(stored);
        return Array.isArray(parsed)
            ? ALL_OVERLAY_TYPES.filter((type) => parsed.includes(type))
            : ALL_OVERLAY_TYPES;
    } catch {
        return ALL_OVERLAY_TYPES;
    }
}

function queryParam(name: string): string | null {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get(name);
}

const VIEW_MODES: MeetingsViewMode[] = ["list", "calendar"];

function isViewMode(value: unknown): value is MeetingsViewMode {
    return VIEW_MODES.includes(value as MeetingsViewMode);
}

function rememberView(view: MeetingsViewMode): void {
    try {
        document.cookie = `${VIEW_COOKIE}=${view}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
        // A preference is a nicety; the page still works without it.
    }
}

/**
 * `?view=` wins, so a shared link always lands on the view it names. Failing
 * that, the view the server opened the page on — it knows this browser's
 * remembered choice and whether the link is about the list (an attendance
 * deep link), and is what decided which data to send, so following it keeps
 * the two from disagreeing. The calendar is the default.
 */
function initialView(
    fromServer: MeetingsViewMode | undefined,
    improved: boolean,
): MeetingsViewMode {
    const fromQuery = queryParam("view");
    if (isViewMode(fromQuery)) return fromQuery;

    // Without `crm.meetings-page-improvements`: the browser's last choice, and
    // the list when it has none.
    if (!improved) {
        if (typeof window === "undefined") return "list";
        try {
            const stored = localStorage.getItem(LEGACY_VIEW_STORAGE_KEY);
            return isViewMode(stored) ? stored : "list";
        } catch {
            return "list";
        }
    }

    return isViewMode(fromServer) ? fromServer : "calendar";
}

function initialMonth(): string {
    const month = queryParam("cal_month");
    // Bounded to 01-12, not just two digits — a deep link with `cal_month`
    // hand-edited to `2026-13` (or `-00`) would otherwise pass this check and
    // then fail to parse as a real month wherever it's actually used.
    return month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
        ? month
        : dayjs().format("YYYY-MM");
}

/**
 * Cards/list/calendar mode and the calendar's month.
 *
 * These are view state, not navigation: they're kept in `useState` and written
 * back to the address bar with `replaceState` (shareable links, working
 * back/forward) instead of an Inertia visit. The calendar's month does need
 * server data, but as a partial reload of the deferred `calendarMeetings` key
 * — the page itself never re-renders from scratch.
 */
export default function useMeetingsViewNavigation(
    serverView: MeetingsViewMode | undefined,
    improved: boolean,
) {
    const [view, setViewState] = useState<MeetingsViewMode>(() =>
        initialView(serverView, improved),
    );

    const setView = useCallback(
        (next: MeetingsViewMode) => {
            setViewState(next);
            if (improved) {
                rememberView(next);
                return;
            }
            try {
                localStorage.setItem(LEGACY_VIEW_STORAGE_KEY, next);
            } catch {
                // Preference is a nicety; failing to store it isn't an error.
            }
        },
        [improved],
    );

    const [calendarMonth, setCalendarMonth] = useState<string>(initialMonth);
    const [overlayTypes, setOverlayTypes] =
        useState<UserCalendarEventType[]>(initialOverlayTypes);

    const stateRef = useRef({ view, calendarMonth, improved });
    useEffect(() => {
        stateRef.current = { view, calendarMonth, improved };
    });

    const syncUrl = useCallback(() => {
        if (typeof window === "undefined") return;
        const {
            view: currentView,
            calendarMonth: month,
            improved: named,
        } = stateRef.current;
        const url = new URL(window.location.href);
        if (currentView === "calendar") {
            url.searchParams.set("view", "calendar");
            url.searchParams.set("cal_month", month);
        } else {
            if (named) {
                // Named, not left implicit: the calendar is the default, so a
                // list link without it would open as a calendar for whoever
                // received it.
                url.searchParams.set("view", "list");
            } else {
                // The list was the default, so it needed no parameter.
                url.searchParams.delete("view");
            }
            url.searchParams.delete("cal_month");
        }
        window.history.replaceState(window.history.state, "", url.toString());
    }, []);

    useEffect(() => {
        syncUrl();
    }, [view, calendarMonth, syncUrl]);

    // Inertia rewrites the address bar to whatever URL was current when a
    // request was dispatched once it resolves — including the deferred
    // calendar fetch — so re-stamp after every request finishes.
    useEffect(() => router.on("finish", syncUrl), [syncUrl]);

    const toggleOverlayType = useCallback((type: UserCalendarEventType) => {
        setOverlayTypes((types) => {
            const next = types.includes(type)
                ? types.filter((current) => current !== type)
                : [...types, type];
            try {
                localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(next));
            } catch {
                // Preference is a nicety; failing to store it isn't an error.
            }
            return next;
        });
    }, []);

    return {
        view,
        setView,
        calendarMonth,
        setCalendarMonth,
        overlayTypes,
        toggleOverlayType,
    };
}
