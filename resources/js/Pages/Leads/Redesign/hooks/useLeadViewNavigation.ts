import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { parseCategorySectionId } from "@/Pages/Deals/Redesign/config/dealInfoSections";
import { isLeadInfoCoreSection } from "../config/leadInfoSections";
import type { LeadInfoSectionId, WorkspaceTabId } from "../types";
import { normalizeTabId, WORKSPACE_TABS } from "../config/workspaceTabs";

const VALID_TABS: WorkspaceTabId[] = WORKSPACE_TABS.map((t) => t.id);
const DEFAULT_INFO_SECTION: LeadInfoSectionId = "personal";

function isValidLeadInfoSection(
    section: string,
    categories?: Array<{ id: number }>,
): section is LeadInfoSectionId {
    if (isLeadInfoCoreSection(section)) return true;
    const categoryId = parseCategorySectionId(section);
    if (categoryId == null) return false;
    if (!categories?.length) return true;
    return categories.some((category) => category.id === categoryId);
}

function getInitialTab(): WorkspaceTabId {
    if (typeof window === "undefined") return "overview";
    const normalized = normalizeTabId(
        new URLSearchParams(window.location.search).get("tab"),
    );
    return normalized && VALID_TABS.includes(normalized)
        ? normalized
        : "overview";
}

function getInitialLeadInfoSection(
    categories?: Array<{ id: number }>,
): LeadInfoSectionId {
    if (typeof window !== "undefined") {
        const section = new URLSearchParams(window.location.search).get(
            "section",
        );
        if (section && isValidLeadInfoSection(section, categories)) {
            return section;
        }
    }
    return DEFAULT_INFO_SECTION;
}

function getInitialFlag(key: string): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get(key) === "open";
}

function syncQuery(
    tab: WorkspaceTabId,
    qualificationOpen: boolean,
    answersOpen: boolean,
    infoSection?: LeadInfoSectionId,
) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    if (qualificationOpen) {
        url.searchParams.set("qualification", "open");
    } else {
        url.searchParams.delete("qualification");
    }
    if (answersOpen) {
        url.searchParams.set("answers", "open");
    } else {
        url.searchParams.delete("answers");
    }
    if (tab === "leadinfo" && infoSection) {
        url.searchParams.set("section", infoSection);
    } else {
        url.searchParams.delete("section");
    }
    url.searchParams.delete("drawer");
    window.history.replaceState({}, "", url.toString());
}

/**
 * Tab + lead-info section + modal open state, URL-synced via replaceState.
 * Includes the Deal-page `finish` guard for deferred Inertia reloads.
 */
export default function useLeadViewNavigation(
    categories?: Array<{ id: number }>,
) {
    const [tab, setTabState] = useState<WorkspaceTabId>(() => getInitialTab());
    const [infoSection, setInfoSectionState] = useState<LeadInfoSectionId>(() =>
        getInitialLeadInfoSection(categories),
    );
    const [qualificationOpen, setQualificationOpenState] = useState(() =>
        getInitialFlag("qualification"),
    );
    const [answersOpen, setAnswersOpenState] = useState(() =>
        getInitialFlag("answers"),
    );

    const tabRef = useRef(tab);
    tabRef.current = tab;
    const infoSectionRef = useRef(infoSection);
    infoSectionRef.current = infoSection;
    const qualificationOpenRef = useRef(qualificationOpen);
    qualificationOpenRef.current = qualificationOpen;
    const answersOpenRef = useRef(answersOpen);
    answersOpenRef.current = answersOpen;

    useEffect(() => {
        setInfoSectionState((current) => {
            if (isValidLeadInfoSection(current, categories)) return current;
            return DEFAULT_INFO_SECTION;
        });
    }, [categories]);

    useEffect(() => {
        return router.on("finish", () => {
            syncQuery(
                tabRef.current,
                qualificationOpenRef.current,
                answersOpenRef.current,
                tabRef.current === "leadinfo"
                    ? infoSectionRef.current
                    : undefined,
            );
        });
    }, []);

    const setTab = useCallback(
        (next: WorkspaceTabId) => {
            setTabState(next);
            syncQuery(
                next,
                qualificationOpen,
                answersOpen,
                next === "leadinfo" ? infoSection : undefined,
            );
        },
        [answersOpen, infoSection, qualificationOpen],
    );

    const setInfoSection = useCallback(
        (section: LeadInfoSectionId) => {
            setInfoSectionState(section);
            if (tab === "leadinfo") {
                syncQuery(tab, qualificationOpen, answersOpen, section);
            }
        },
        [answersOpen, qualificationOpen, tab],
    );

    const setQualificationOpen = useCallback(
        (open: boolean) => {
            setQualificationOpenState(open);
            syncQuery(
                tab,
                open,
                answersOpen,
                tab === "leadinfo" ? infoSection : undefined,
            );
        },
        [answersOpen, infoSection, tab],
    );

    const setAnswersOpen = useCallback(
        (open: boolean) => {
            setAnswersOpenState(open);
            syncQuery(
                tab,
                qualificationOpen,
                open,
                tab === "leadinfo" ? infoSection : undefined,
            );
        },
        [infoSection, qualificationOpen, tab],
    );

    return useMemo(
        () => ({
            tab,
            setTab,
            infoSection,
            setInfoSection,
            qualificationOpen,
            setQualificationOpen,
            answersOpen,
            setAnswersOpen,
        }),
        [
            tab,
            setTab,
            infoSection,
            setInfoSection,
            qualificationOpen,
            setQualificationOpen,
            answersOpen,
            setAnswersOpen,
        ],
    );
}
