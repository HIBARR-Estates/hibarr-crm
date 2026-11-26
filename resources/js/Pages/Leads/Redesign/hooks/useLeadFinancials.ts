import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useApiQuery } from "@/lib/api/client";
import type {
    FinFailure,
    FinFinaliseInput,
    FinLineInput,
    FinSource,
    FinWorkspace,
} from "../components/financials/types";

interface WorkspaceResponse {
    status: string;
    message?: string;
    data: FinWorkspace;
}

export type FinancialsAction =
    | "load"
    | "start"
    | "draft"
    | "line"
    | "discard"
    | "finalise"
    | "verify"
    | "refresh";

export interface LeadFinancials {
    /** False when the feature flag is off: nothing is requested and the tab is hidden. */
    enabled: boolean;
    data: FinWorkspace | null;
    loading: boolean;
    loadFailed: boolean;
    /** The latest action in flight, or null. Actions run strictly one after another (queued, never dropped). */
    pending: FinancialsAction | null;
    /** The reason the last action was refused (cleared by the next action). */
    failure: FinFailure | null;
    startDraft: (source?: FinSource) => Promise<boolean>;
    updateDraft: (changes: { as_of_date?: string; source?: FinSource; notes?: string | null }) => Promise<boolean>;
    discardDraft: () => Promise<boolean>;
    addLine: (typeKey: string, input: FinLineInput) => Promise<boolean>;
    updateLine: (lineId: number, input: FinLineInput) => Promise<boolean>;
    removeLine: (lineId: number) => Promise<boolean>;
    finalise: (input?: FinFinaliseInput) => Promise<boolean>;
    verify: (assessmentId: number) => Promise<boolean>;
    /** Re-read from the server, e.g. to retry a rate that could not be fetched. */
    refresh: () => Promise<boolean>;
    clearFailure: () => void;
}

const JSON_HEADERS = { headers: { Accept: "application/json" } };

/**
 * The lead's financial assessments, as local state. The first load is a
 * background GET (never blocks first paint); every change then posts to its
 * endpoint and replaces this state with the payload that comes back, so edits
 * never trigger an Inertia reload.
 */
export default function useLeadFinancials(leadId: number, enabled: boolean): LeadFinancials {
    const query = useApiQuery<WorkspaceResponse>({
        path: route("lead-contact.financial.show", leadId),
        options: { enabled, staleTime: 30_000 },
    });

    const [data, setData] = useState<FinWorkspace | null>(null);
    const [pending, setPending] = useState<FinancialsAction | null>(null);
    const [failure, setFailure] = useState<FinFailure | null>(null);
    const seededFor = useRef<number | null>(null);
    const chain = useRef<Promise<unknown>>(Promise.resolve());
    const inFlight = useRef(0);

    // Seed once per lead; later query refreshes must not clobber what an action just returned.
    useEffect(() => {
        if (!enabled) return;
        if (seededFor.current !== null && seededFor.current !== leadId) {
            seededFor.current = null;
            setData(null);
        }
        if (seededFor.current === null && query.data?.data) {
            setData(query.data.data);
            seededFor.current = leadId;
        }
    }, [enabled, leadId, query.data]);

    const execute = useCallback(
        async (action: FinancialsAction, request: () => Promise<{ data: WorkspaceResponse }>): Promise<boolean> => {
            inFlight.current += 1;
            setPending(action);
            setFailure(null);
            try {
                const response = await request();
                if (response.data?.status === "success" && response.data.data) {
                    setData(response.data.data);
                    seededFor.current = leadId;
                    return true;
                }
                setFailure({ message: response.data?.message ?? "", reason: null, missingRates: [] });
                return false;
            } catch (error) {
                const body = (error as {
                    response?: {
                        data?: {
                            message?: string;
                            reason?: string;
                            missing_rates?: string[];
                            errors?: Record<string, string[]>;
                        };
                    };
                })?.response?.data;
                const firstValidation = body?.errors ? Object.values(body.errors).flat()[0] : undefined;
                setFailure({
                    message: body?.message ?? firstValidation ?? "",
                    reason: body?.reason ?? null,
                    missingRates: body?.missing_rates ?? [],
                });
                return false;
            } finally {
                inFlight.current -= 1;
                if (inFlight.current === 0) setPending(null);
            }
        },
        [leadId],
    );

    // Strictly sequential: a field saved on blur and the next edit made straight after
    // both reach the server, in order, instead of the second being dropped.
    const run = useCallback(
        (action: FinancialsAction, request: () => Promise<{ data: WorkspaceResponse }>): Promise<boolean> => {
            const task = chain.current.then(() => execute(action, request));
            chain.current = task.catch(() => false);
            return task;
        },
        [execute],
    );

    const base = (suffix = "") => `${route("lead-contact.financial.show", leadId)}${suffix}`;

    return {
        enabled,
        data,
        loading: enabled && data === null && query.isLoading,
        loadFailed: enabled && data === null && query.isError,
        pending,
        failure,
        startDraft: useCallback(
            (source: FinSource = "manual") =>
                run("start", () => axios.post(base("/draft"), { source }, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        updateDraft: useCallback(
            (changes) => run("draft", () => axios.put(base("/draft"), changes, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        discardDraft: useCallback(
            () => run("discard", () => axios.delete(base("/draft"), JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        addLine: useCallback(
            (typeKey, input) =>
                run("line", () => axios.post(base("/draft/lines"), { type_key: typeKey, ...input }, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        updateLine: useCallback(
            (lineId, input) =>
                run("line", () => axios.put(base(`/draft/lines/${lineId}`), input, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        removeLine: useCallback(
            (lineId) => run("line", () => axios.delete(base(`/draft/lines/${lineId}`), JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        finalise: useCallback(
            (input = {}) => run("finalise", () => axios.post(base("/draft/finalise"), input, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        verify: useCallback(
            (assessmentId) =>
                run("verify", () => axios.post(base(`/assessments/${assessmentId}/verify`), {}, JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        refresh: useCallback(
            () => run("refresh", () => axios.get(base(), JSON_HEADERS)),
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [run, leadId],
        ),
        clearFailure: useCallback(() => setFailure(null), []),
    };
}
