import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { DealInfoSectionId, DealTab } from "../types";
import { parseCategorySectionId } from "../config/dealInfoSections";

const VALID_TABS: DealTab[] = [
    "overview",
    "notes",
    "tasks",
    "meetings",
    "files",
    "offers",
    "recommendations",
    "itinerary",
    "dealinfo",
    "timeline",
];

const VALID_CORE_INFO_SECTIONS = [
    "general",
    "experience",
    "income",
    "location",
    "preftimeline",
    "gdpr",
] as const;

function isValidInfoSection(section: string): section is DealInfoSectionId {
    return (
        VALID_CORE_INFO_SECTIONS.includes(
            section as (typeof VALID_CORE_INFO_SECTIONS)[number],
        ) || parseCategorySectionId(section) !== null
    );
}

function getInitialTab(): DealTab {
    if (typeof window === "undefined") return "overview";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return VALID_TABS.includes(tab as DealTab) ? (tab as DealTab) : "overview";
}

function getInitialSection(): DealInfoSectionId {
    if (typeof window === "undefined") return "general";
    const section = new URLSearchParams(window.location.search).get("section");
    return section && isValidInfoSection(section) ? section : "general";
}

function syncQuery(tab: DealTab, section?: DealInfoSectionId) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (tab === "dealinfo" && section) {
        url.searchParams.set("section", section);
    } else {
        url.searchParams.delete("section");
    }
    window.history.replaceState({}, "", url.toString());
}

/**
 * Single flat-tab navigation matching v2.2. `tab` is the one active tab
 * (record or meta); `infoSection` is the Deal-info tab's internal left-nav
 * selection, only meaningful while `tab === "dealinfo"`.
 */
export default function useDealViewNavigation() {
    const [tab, setTabState] = useState<DealTab>(() => getInitialTab());
    const [infoSection, setInfoSectionState] = useState<DealInfoSectionId>(() =>
        getInitialSection(),
    );

    const tabRef = useRef(tab);
    tabRef.current = tab;
    const infoSectionRef = useRef(infoSection);
    infoSectionRef.current = infoSection;

    useEffect(() => {
        // Deferred props (formMeta/taskMeta/timeline/...) are requested with
        // whatever URL was current when they were dispatched (right after
        // mount) and, on completion, Inertia unconditionally rewrites the
        // address bar to that stale URL — silently reverting a tab switch
        // that happened while the request was in flight. Re-stamp our tab
        // state into the URL after every Inertia request finishes so those
        // background reloads can't clobber it.
        return router.on("finish", () => {
            syncQuery(
                tabRef.current,
                tabRef.current === "dealinfo" ? infoSectionRef.current : undefined,
            );
        });
    }, []);

    const setTab = useCallback(
        (nextTab: DealTab) => {
            setTabState(nextTab);
            syncQuery(nextTab, nextTab === "dealinfo" ? infoSection : undefined);
        },
        [infoSection],
    );

    const setInfoSection = useCallback(
        (section: DealInfoSectionId) => {
            setInfoSectionState(section);
            if (tab === "dealinfo") {
                syncQuery("dealinfo", section);
            }
        },
        [tab],
    );

    const goToDealInfo = useCallback((section?: DealInfoSectionId) => {
        setTabState("dealinfo");
        if (section) {
            setInfoSectionState(section);
            syncQuery("dealinfo", section);
        } else {
            setInfoSectionState((current) => {
                syncQuery("dealinfo", current);
                return current;
            });
        }
    }, []);

    return useMemo(
        () => ({
            tab,
            infoSection,
            setTab,
            setInfoSection,
            goToDealInfo,
        }),
        [tab, infoSection, setTab, setInfoSection, goToDealInfo],
    );
}
