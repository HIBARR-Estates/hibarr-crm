import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import type { LeadDuplicateCandidate } from "@/Types/api/lead-merge";
import useLeadMergeAccess from "@/Features/Leads/Merge/useLeadMergeAccess";

interface DuplicatesResponse {
    status: "success";
    message: string;
    duplicates: LeadDuplicateCandidate[];
}

interface CachedDuplicates {
    duplicates: LeadDuplicateCandidate[];
    fetchedAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(leadId: number) {
    return `lead-duplicates:${leadId}`;
}

function readCache(leadId: number): CachedDuplicates | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = sessionStorage.getItem(cacheKey(leadId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedDuplicates;
        if (!Array.isArray(parsed?.duplicates) || !parsed.fetchedAt) return null;
        if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeCache(leadId: number, duplicates: LeadDuplicateCandidate[]) {
    if (typeof window === "undefined") return;
    try {
        const payload: CachedDuplicates = {
            duplicates,
            fetchedAt: Date.now(),
        };
        sessionStorage.setItem(cacheKey(leadId), JSON.stringify(payload));
    } catch {
        /* quota / private mode */
    }
}

export function leadDuplicatesQueryKey(leadId: number) {
    return ["lead-duplicates", leadId] as const;
}

async function fetchDuplicates(
    leadId: number,
): Promise<LeadDuplicateCandidate[]> {
    const response = await axios.get<DuplicatesResponse>(
        route("lead-contact.duplicates", leadId),
        { headers: { Accept: "application/json" } },
    );
    const duplicates = response.data?.duplicates ?? [];
    writeCache(leadId, duplicates);
    return duplicates;
}

/**
 * Auto-checks lead duplicates on mount (cached per lead in sessionStorage +
 * React Query). Manual findDuplicates() forces the card visible even when
 * empty so the user can dismiss a "none found" result.
 */
export default function useLeadDuplicates(leadId: number) {
    const canMerge = useLeadMergeAccess();
    const queryClient = useQueryClient();
    const [dismissed, setDismissed] = useState(false);
    const [userVisible, setUserVisible] = useState(false);
    const [manualRequested, setManualRequested] = useState(false);

    const cached = readCache(leadId);

    const query = useQuery({
        queryKey: leadDuplicatesQueryKey(leadId),
        queryFn: () => fetchDuplicates(leadId),
        enabled: canMerge && leadId > 0,
        staleTime: CACHE_TTL_MS,
        gcTime: CACHE_TTL_MS * 2,
        initialData: cached?.duplicates,
        initialDataUpdatedAt: cached?.fetchedAt,
    });

    const duplicates = query.data ?? [];
    const hasDuplicates = duplicates.length > 0;

    // Reset dismiss/user-visible when navigating to another lead.
    useEffect(() => {
        setDismissed(false);
        setUserVisible(false);
        setManualRequested(false);
    }, [leadId]);

    const findDuplicates = useCallback(async () => {
        if (!canMerge) return;
        setDismissed(false);
        setUserVisible(true);
        setManualRequested(true);
        try {
            await queryClient.fetchQuery({
                queryKey: leadDuplicatesQueryKey(leadId),
                queryFn: () => fetchDuplicates(leadId),
                staleTime: 0,
            });
        } finally {
            setManualRequested(false);
        }
    }, [canMerge, leadId, queryClient]);

    const dismiss = useCallback(() => {
        setDismissed(true);
        setUserVisible(false);
        setManualRequested(false);
    }, []);

    const invalidate = useCallback(async () => {
        setUserVisible(false);
        await queryClient.fetchQuery({
            queryKey: leadDuplicatesQueryKey(leadId),
            queryFn: () => fetchDuplicates(leadId),
            staleTime: 0,
        });
    }, [leadId, queryClient]);

    // Manual find: show spinner. Auto check stays silent until results land.
    const isLoading = canMerge && (manualRequested || (userVisible && query.isFetching));

    // Auto: only surface when duplicates exist. Manual: always surface until dismissed.
    const visible =
        canMerge &&
        !dismissed &&
        (userVisible || hasDuplicates);

    return {
        canMerge,
        visible,
        isLoading,
        duplicates,
        hasDuplicates,
        findDuplicates,
        dismiss,
        invalidate,
        error: query.error,
    };
}
