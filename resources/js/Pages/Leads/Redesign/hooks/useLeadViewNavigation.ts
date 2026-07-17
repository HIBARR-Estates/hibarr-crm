import { useCallback, useMemo, useState } from "react";
import type { LeadDrawerTab } from "../types";

const VALID_DRAWER_TABS: LeadDrawerTab[] = [
    "overview",
    "profile",
    "notes",
    "tasks",
    "meetings",
    "itinerary",
    "deals",
    "marketing",
    "activity",
];

function getInitialDrawerTab(): LeadDrawerTab {
    if (typeof window === "undefined") return "overview";
    const drawer = new URLSearchParams(window.location.search).get("drawer");
    return VALID_DRAWER_TABS.includes(drawer as LeadDrawerTab)
        ? (drawer as LeadDrawerTab)
        : "overview";
}

function setDrawerQuery(drawer: LeadDrawerTab) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("drawer", drawer);
    url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.toString());
}

export default function useLeadViewNavigation() {
    const [drawerTab, setDrawerTabState] = useState<LeadDrawerTab>(() =>
        getInitialDrawerTab(),
    );
    const [profileEditMode, setProfileEditMode] = useState(false);

    const setDrawerTab = useCallback((tab: LeadDrawerTab) => {
        setDrawerTabState(tab);
        setDrawerQuery(tab);
    }, []);

    const openProfileEdit = useCallback(() => {
        setProfileEditMode(true);
        setDrawerTabState("profile");
        setDrawerQuery("profile");
    }, []);

    return useMemo(
        () => ({
            drawerTab,
            setDrawerTab,
            profileEditMode,
            setProfileEditMode,
            openProfileEdit,
        }),
        [drawerTab, openProfileEdit, profileEditMode, setDrawerTab],
    );
}
