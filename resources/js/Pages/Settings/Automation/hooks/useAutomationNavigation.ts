import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { AutomationScreen } from "../types";

const VALID_SCREENS: AutomationScreen[] = [
    "overview",
    "automations",
    "builder",
    "detail",
    "templates",
    "editor",
    "metaEvents",
    "logs",
];

function getInitialScreen(): AutomationScreen {
    if (typeof window === "undefined") return "overview";
    const screen = new URLSearchParams(window.location.search).get("screen");
    return VALID_SCREENS.includes(screen as AutomationScreen) ? (screen as AutomationScreen) : "overview";
}

function getInitialId(param: string): number | null {
    if (typeof window === "undefined") return null;
    const raw = new URLSearchParams(window.location.search).get(param);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
}

function syncQuery(screen: AutomationScreen, autoId: number | null, tplId: number | null) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("screen", screen);

    if ((screen === "builder" || screen === "detail") && autoId) {
        url.searchParams.set("id", String(autoId));
    } else {
        url.searchParams.delete("id");
    }

    if (screen === "editor" && tplId) {
        url.searchParams.set("tpl", String(tplId));
    } else {
        url.searchParams.delete("tpl");
    }

    window.history.replaceState({}, "", url.toString());
}

/**
 * URL-synced screen navigation for the Automation settings SPA (overview /
 * automations list / builder / detail / templates / editor / logs), so a
 * refresh lands back where the user was instead of resetting to overview —
 * same client-side, history.replaceState-based pattern as
 * Deals/Redesign's useDealViewNavigation.
 */
export default function useAutomationNavigation() {
    const [screen, setScreenState] = useState<AutomationScreen>(() => getInitialScreen());
    const [autoId, setAutoIdState] = useState<number | null>(() => getInitialId("id"));
    const [tplId, setTplIdState] = useState<number | null>(() => getInitialId("tpl"));

    const screenRef = useRef(screen);
    screenRef.current = screen;
    const autoIdRef = useRef(autoId);
    autoIdRef.current = autoId;
    const tplIdRef = useRef(tplId);
    tplIdRef.current = tplId;

    useEffect(() => {
        // automations/templates/catalog arrive as deferred props requested
        // right after mount; Inertia rewrites the address bar to whatever URL
        // was current when that background request finishes, which can
        // clobber a navigation that happened in the meantime — re-stamp our
        // own state after every request settles, same guard as
        // useDealViewNavigation.
        return router.on("finish", () => {
            syncQuery(screenRef.current, autoIdRef.current, tplIdRef.current);
        });
    }, []);

    const setAll = useCallback((nextScreen: AutomationScreen, nextAutoId: number | null, nextTplId: number | null) => {
        setScreenState(nextScreen);
        setAutoIdState(nextAutoId);
        setTplIdState(nextTplId);
        syncQuery(nextScreen, nextAutoId, nextTplId);
    }, []);

    const goOverview = useCallback(() => setAll("overview", null, null), [setAll]);
    const goAutomations = useCallback(() => setAll("automations", null, null), [setAll]);
    const goBuilder = useCallback((id: number | null) => setAll("builder", id, null), [setAll]);
    const goDetail = useCallback((id: number) => setAll("detail", id, null), [setAll]);
    const goTemplates = useCallback(() => setAll("templates", null, null), [setAll]);
    const goEditor = useCallback((id: number | null) => setAll("editor", null, id), [setAll]);
    const goMetaEvents = useCallback(() => setAll("metaEvents", null, null), [setAll]);
    const goLogs = useCallback(() => setAll("logs", null, null), [setAll]);

    return useMemo(
        () => ({
            screen,
            autoId,
            tplId,
            goOverview,
            goAutomations,
            goBuilder,
            goDetail,
            goTemplates,
            goEditor,
            goMetaEvents,
            goLogs,
        }),
        [screen, autoId, tplId, goOverview, goAutomations, goBuilder, goDetail, goTemplates, goEditor, goMetaEvents, goLogs],
    );
}
