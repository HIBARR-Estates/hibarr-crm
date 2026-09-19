import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "@inertiajs/react";

export const LEAD_SETTINGS_TABS = ["sources", "statuses", "sla"] as const;

export type LeadSettingsTab = (typeof LEAD_SETTINGS_TABS)[number];

function isLeadSettingsTab(value: string | null): value is LeadSettingsTab {
    return LEAD_SETTINGS_TABS.includes(value as LeadSettingsTab);
}

function readTab(): LeadSettingsTab {
    if (typeof window === "undefined") return "sources";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return isLeadSettingsTab(tab) ? tab : "sources";
}

function syncTab(tab: LeadSettingsTab) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
}

/**
 * Client-side tab state for the lead settings hub, kept in `?tab=` so a
 * refresh or shared link lands on the same group — same pattern as the
 * deal redesign and Custom Fields settings.
 */
export default function useLeadSettingsNavigation() {
    const [tab, setTabState] = useState<LeadSettingsTab>(() => readTab());
    const tabRef = useRef(tab);
    tabRef.current = tab;

    useEffect(() => {
        return router.on("finish", () => {
            syncTab(tabRef.current);
        });
    }, []);

    const setTab = useCallback((next: LeadSettingsTab) => {
        setTabState(next);
        syncTab(next);
    }, []);

    return { tab, setTab };
}
