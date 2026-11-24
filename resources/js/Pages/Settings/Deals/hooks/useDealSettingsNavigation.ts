import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";

export const DEAL_SETTINGS_TABS = ["pipelines", "analysis"] as const;

export type DealSettingsTab = (typeof DEAL_SETTINGS_TABS)[number];

function isDealSettingsTab(value: string | null): value is DealSettingsTab {
    return DEAL_SETTINGS_TABS.includes(value as DealSettingsTab);
}

function readTab(): DealSettingsTab {
    if (typeof window === "undefined") return "pipelines";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return isDealSettingsTab(tab) ? tab : "pipelines";
}

function syncTab(tab: DealSettingsTab) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    // Route is still analysis-script-builder.show — don't write ?tab= onto another page.
    if (!url.pathname.includes("analysis-script-builder")) return;
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
}

/**
 * Client-side tab state for Deal Settings, kept in `?tab=` so refresh/share
 * land on the same group — mirrors lead settings navigation.
 */
export default function useDealSettingsNavigation() {
    const [tab, setTabState] = useState<DealSettingsTab>(() => readTab());
    const tabRef = useRef(tab);
    tabRef.current = tab;

    useEffect(() => {
        return router.on("finish", () => {
            syncTab(tabRef.current);
        });
    }, []);

    const setTab = useCallback((next: DealSettingsTab) => {
        setTabState(next);
        syncTab(next);
    }, []);

    return { tab, setTab };
}
