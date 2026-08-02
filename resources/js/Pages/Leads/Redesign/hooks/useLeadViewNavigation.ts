import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import type { WorkspaceTabId } from "../types";
import { WORKSPACE_TABS } from "../config/workspaceTabs";

const VALID_TABS: WorkspaceTabId[] = WORKSPACE_TABS.map((t) => t.id);

function getInitialTab(): WorkspaceTabId {
    if (typeof window === "undefined") return "overview";
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return VALID_TABS.includes(tab as WorkspaceTabId)
        ? (tab as WorkspaceTabId)
        : "overview";
}

function getInitialFlag(key: string): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get(key) === "open";
}

function syncQuery(
    tab: WorkspaceTabId,
    qualificationOpen: boolean,
    answersOpen: boolean,
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
    // Drop legacy drawer= param from the prior redesign.
    url.searchParams.delete("drawer");
    window.history.replaceState({}, "", url.toString());
}

/**
 * Tab + qualification/answers modal open state, URL-synced via replaceState.
 * Includes the Deal-page `finish` guard so deferred Inertia reloads cannot
 * revert the address bar after a tab switch made while they were in flight.
 */
export default function useLeadViewNavigation() {
    const [tab, setTabState] = useState<WorkspaceTabId>(() => getInitialTab());
    const [qualificationOpen, setQualificationOpenState] = useState(() =>
        getInitialFlag("qualification"),
    );
    const [answersOpen, setAnswersOpenState] = useState(() =>
        getInitialFlag("answers"),
    );

    const tabRef = useRef(tab);
    tabRef.current = tab;
    const qualificationOpenRef = useRef(qualificationOpen);
    qualificationOpenRef.current = qualificationOpen;
    const answersOpenRef = useRef(answersOpen);
    answersOpenRef.current = answersOpen;

    useEffect(() => {
        return router.on("finish", () => {
            syncQuery(
                tabRef.current,
                qualificationOpenRef.current,
                answersOpenRef.current,
            );
        });
    }, []);

    const setTab = useCallback(
        (next: WorkspaceTabId) => {
            setTabState(next);
            syncQuery(next, qualificationOpen, answersOpen);
        },
        [qualificationOpen, answersOpen],
    );

    const setQualificationOpen = useCallback(
        (open: boolean) => {
            setQualificationOpenState(open);
            syncQuery(tab, open, answersOpen);
        },
        [tab, answersOpen],
    );

    const setAnswersOpen = useCallback(
        (open: boolean) => {
            setAnswersOpenState(open);
            syncQuery(tab, qualificationOpen, open);
        },
        [tab, qualificationOpen],
    );

    return useMemo(
        () => ({
            tab,
            setTab,
            qualificationOpen,
            setQualificationOpen,
            answersOpen,
            setAnswersOpen,
        }),
        [
            tab,
            setTab,
            qualificationOpen,
            setQualificationOpen,
            answersOpen,
            setAnswersOpen,
        ],
    );
}
