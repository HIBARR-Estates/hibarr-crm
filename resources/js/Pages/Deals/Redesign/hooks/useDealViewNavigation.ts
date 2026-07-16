import { useCallback, useMemo, useState } from "react";
import { DealInfoSectionId, DealMainTab, WorkspaceSubTab } from "../types";
import { parseCategorySectionId } from "../config/dealInfoSections";

const VALID_TABS: DealMainTab[] = ["workspace", "dealinfo", "timeline"];
const VALID_CORE_INFO_SECTIONS = [
    "general",
    "experience",
    "property",
    "income",
    "location",
    "preftimeline",
    "funding",
    "support",
] as const;

function isValidInfoSection(section: string): section is DealInfoSectionId {
    return (
        VALID_CORE_INFO_SECTIONS.includes(
            section as (typeof VALID_CORE_INFO_SECTIONS)[number],
        ) || parseCategorySectionId(section) !== null
    );
}
const VALID_WORKSPACE_SUB_TABS: WorkspaceSubTab[] = [
    "overview",
    "notes",
    "tasks",
    "meetings",
    "files",
    "offers",
    "recommendations",
    "itinerary",
];

function getInitialSection(): DealInfoSectionId {
    if (typeof window === "undefined") return "general";
    const section = new URLSearchParams(window.location.search).get("section");
    return section && isValidInfoSection(section) ? section : "general";
}

function getInitialTab(): DealMainTab {
    if (typeof window === "undefined") return "workspace";
    const tab = new URLSearchParams(window.location.search).get("tab");
    return VALID_TABS.includes(tab as DealMainTab) ? (tab as DealMainTab) : "workspace";
}

function getInitialWorkspaceSubTab(): WorkspaceSubTab {
    if (typeof window === "undefined") return "overview";
    const subTab = new URLSearchParams(window.location.search).get("subtab");
    return VALID_WORKSPACE_SUB_TABS.includes(subTab as WorkspaceSubTab)
        ? (subTab as WorkspaceSubTab)
        : "overview";
}

function setQuery(nextTab: DealMainTab, section?: DealInfoSectionId, subTab?: WorkspaceSubTab) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", nextTab);
    if (section) {
        url.searchParams.set("section", section);
    } else {
        url.searchParams.delete("section");
    }
    if (subTab && nextTab === "workspace") {
        url.searchParams.set("subtab", subTab);
    } else {
        url.searchParams.delete("subtab");
    }
    window.history.replaceState({}, "", url.toString());
}

export default function useDealViewNavigation() {
    const [mainTab, setMainTabState] = useState<DealMainTab>(() => getInitialTab());
    const [infoSection, setInfoSectionState] = useState<DealInfoSectionId>(() => getInitialSection());
    const [workspaceSubTab, setWorkspaceSubTabState] = useState<WorkspaceSubTab>(() =>
        getInitialWorkspaceSubTab(),
    );

    const setMainTab = useCallback((tab: DealMainTab) => {
        setMainTabState(tab);
        setQuery(
            tab,
            tab === "dealinfo" ? infoSection : undefined,
            tab === "workspace" ? workspaceSubTab : undefined,
        );
    }, [infoSection, workspaceSubTab]);

    const setInfoSection = useCallback((section: DealInfoSectionId) => {
        setInfoSectionState(section);
        if (mainTab === "dealinfo") {
            setQuery(mainTab, section, workspaceSubTab);
        }
    }, [mainTab, workspaceSubTab]);

    const setWorkspaceSubTab = useCallback((subTab: WorkspaceSubTab) => {
        setWorkspaceSubTabState(subTab);
        if (mainTab === "workspace") {
            setQuery("workspace", undefined, subTab);
            return;
        }

        setMainTabState("workspace");
        setQuery("workspace", undefined, subTab);
    }, [mainTab]);

    const switchToDealInfo = useCallback((section?: DealInfoSectionId) => {
        if (section) {
            setInfoSectionState(section);
            setMainTabState("dealinfo");
            setQuery("dealinfo", section, undefined);
            return;
        }

        setMainTabState("dealinfo");
        setQuery("dealinfo", infoSection, undefined);
    }, [infoSection]);

    return useMemo(
        () => ({
            mainTab,
            infoSection,
            workspaceSubTab,
            setMainTab,
            setInfoSection,
            setWorkspaceSubTab,
            switchToDealInfo,
        }),
        [
            infoSection,
            mainTab,
            setInfoSection,
            setMainTab,
            setWorkspaceSubTab,
            switchToDealInfo,
            workspaceSubTab,
        ],
    );
}
