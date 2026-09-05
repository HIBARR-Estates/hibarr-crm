import { useCallback, useEffect, useRef, useState } from "react";
import dayjs from "dayjs";
import { router } from "@inertiajs/react";
import type { MeetingsViewMode } from "../adapters/meetingViewModel";
import type { UserCalendarEventType } from "./useUserCalendarEvents";

const STATS_STORAGE_KEY = "hibarr_meetings_stats_visible";
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

function initialView(): MeetingsViewMode {
    return queryParam("view") === "calendar" ? "calendar" : "cards";
}

function initialMonth(): string {
    const month = queryParam("cal_month");
    return month && /^\d{4}-\d{2}$/.test(month)
        ? month
        : dayjs().format("YYYY-MM");
}

function initialStatsVisible(): boolean {
    if (typeof window === "undefined") return true;
    try {
        return localStorage.getItem(STATS_STORAGE_KEY) !== "false";
    } catch {
        // Private mode / blocked storage — the tiles are the friendlier default.
        return true;
    }
}

/**
 * Cards/calendar mode, the calendar's month and the stats toggle.
 *
 * These are view state, not navigation: they're kept in `useState` and written
 * back to the address bar with `replaceState` (shareable links, working
 * back/forward) instead of an Inertia visit. The calendar's month does need
 * server data, but as a partial reload of the deferred `calendarMeetings` key
 * — the page itself never re-renders from scratch.
 */
export default function useMeetingsViewNavigation() {
    const [view, setView] = useState<MeetingsViewMode>(initialView);
    const [calendarMonth, setCalendarMonth] = useState<string>(initialMonth);
    const [calendarPersonId, setCalendarPersonId] = useState<number | null>(
        null,
    );
    const [statsVisible, setStatsVisible] = useState<boolean>(
        initialStatsVisible,
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

    const toggleStats = useCallback(() => {
        setStatsVisible((visible) => {
            const next = !visible;
            try {
                localStorage.setItem(STATS_STORAGE_KEY, String(next));
            } catch {
                // Preference is a nicety; failing to store it isn't an error.
            }
            return next;
        });
    }, []);

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
        statsVisible,
        toggleStats,
        overlayTypes,
        toggleOverlayType,
    };
}
