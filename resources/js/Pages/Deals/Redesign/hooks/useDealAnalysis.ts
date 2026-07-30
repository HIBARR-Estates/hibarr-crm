import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

type CompletionType = "auto" | "manual";

function localStorageKey(dealId: number): string {
    return `deal_analysis_minimized_${dealId}`;
}

function wasMinimized(dealId: number): boolean {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(localStorageKey(dealId)) === "1";
}

function setMinimized(dealId: number): void {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(localStorageKey(dealId), "1");
}

function clearMinimized(dealId: number): void {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(localStorageKey(dealId));
}

export interface UseDealAnalysisReturn {
    isOpen: boolean;
    isCompleted: boolean;
    isCompleting: boolean;
    open: () => void;
    minimize: () => void;
    complete: (completionType: CompletionType, unfilledCount: number) => Promise<void>;
}

export default function useDealAnalysis(): UseDealAnalysisReturn {
    const { deal, setDeal } = useDealWorkspace();

    const isCompleted = deal.analysis_status === "completed";

    // Show on mount if not completed and not minimized this session.
    const [isOpen, setIsOpen] = useState<boolean>(() => {
        if (isCompleted) return false;
        return !wasMinimized(deal.id);
    });

    // If analysis becomes completed externally (e.g. another tab), close.
    useEffect(() => {
        if (isCompleted) setIsOpen(false);
    }, [isCompleted]);

    const [isCompleting, setIsCompleting] = useState(false);

    const open = useCallback(() => {
        clearMinimized(deal.id);
        setIsOpen(true);
    }, [deal.id]);

    const minimize = useCallback(() => {
        setMinimized(deal.id);
        setIsOpen(false);
    }, [deal.id]);

    const complete = useCallback(
        async (completionType: CompletionType, unfilledCount: number): Promise<void> => {
            setIsCompleting(true);
            try {
                const resp = await axios.patch(
                    route("deals.gathering.analysis_complete", deal.id),
                    { completion_type: completionType, unfilled_count: unfilledCount },
                    { headers: { Accept: "application/json" } },
                );
                if (resp.data?.status === "success") {
                    clearMinimized(deal.id);
                    setDeal((prev: any) => ({
                        ...prev,
                        analysis_status: "completed",
                        analysis_completed_at: resp.data.analysis_completed_at,
                        analysis_completed_by: resp.data.analysis_completed_by,
                    }));
                    setIsOpen(false);
                }
            } finally {
                setIsCompleting(false);
            }
        },
        [deal.id, setDeal],
    );

    return useMemo(
        () => ({ isOpen, isCompleted, isCompleting, open, minimize, complete }),
        [isOpen, isCompleted, isCompleting, open, minimize, complete],
    );
}
