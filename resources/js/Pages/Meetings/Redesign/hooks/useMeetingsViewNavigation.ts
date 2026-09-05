import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { router } from "@inertiajs/react";
import type { MeetingsViewMode } from "../adapters/meetingViewModel";
import type { UserCalendarEventType } from "./useUserCalendarEvents";

const VIEW_STORAGE_KEY = "hibarr_meetings_view";
const OVERLAY_STORAGE_KEY = "hibarr_meetings_calendar_overlay_types";

/** Everything the overlay can show, on by default. */
const ALL_OVERLAY_TYPES: UserCalendarEventType[] = [
    "task",
    "event",
    "ticket",
    "leave",
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

const VIEW_MODES: MeetingsViewMode[] = ["cards", "list", "calendar"];

function isViewMode(value: unknown): value is MeetingsViewMode {
    return VIEW_MODES.includes(value as MeetingsViewMode);
}

/**
 * `?view=` wins, so a shared link always lands on the view it names; failing
 * that the browser's last choice, which is what someone who always works in
 * the list expects to come back to.
 */
function initialView(): MeetingsViewMode {
    const fromQuery = queryParam("view");
    if (isViewMode(fromQuery)) return fromQuery;
    if (typeof window === "undefined") return "cards";
    try {
        const stored = localStorage.getItem(VIEW_STORAGE_KEY);
        return isViewMode(stored) ? stored : "cards";
    } catch {
        return "cards";
    }
}

function initialMonth(): string {
    const month = queryParam("cal_month");
    return month && /^\d{4}-\d{2}$/.test(month)
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
export default function useMeetingsViewNavigation() {
    const [view, setViewState] = useState<MeetingsViewMode>(initialView);

    const setView = useCallback((next: MeetingsViewMode) => {
        setViewState(next);
        try {
            localStorage.setItem(VIEW_STORAGE_KEY, next);
        } catch {
            // Preference is a nicety; failing to store it isn't an error.
        }
    }, []);

    const [calendarMonth, setCalendarMonth] = useState<string>(initialMonth);
    const [calendarPersonId, setCalendarPersonId] = useState<number | null>(
        null,
    );
    const [overlayTypes, setOverlayTypes] =
        useState<UserCalendarEventType[]>(initialOverlayTypes);

    const stateRef = useRef({ view, calendarMonth });
    useEffect(() => {
        stateRef.current = { view, calendarMonth };
    });

    const syncUrl = useCallback(() => {
        if (typeof window === "undefined") return;
        const { view: currentView, calendarMonth: month } = stateRef.current;
        const url = new URL(window.location.href);
        if (currentView === "calendar") {
            url.searchParams.set("view", "calendar");
            url.searchParams.set("cal_month", month);
        } else if (currentView === "list") {
            url.searchParams.set("view", "list");
            url.searchParams.delete("cal_month");
        } else {
            url.searchParams.delete("view");
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
        calendarPersonId,
        setCalendarPersonId,
        overlayTypes,
        toggleOverlayType,
    };
}
