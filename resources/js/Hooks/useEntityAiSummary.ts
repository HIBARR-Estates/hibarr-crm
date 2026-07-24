import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import type {
    DealSummaryPayload,
    EntitySummaryEntityType,
    EntitySummaryPayload,
    LeadSummaryPayload,
} from "@/Types/entity-summary";

interface UseEntityAiSummaryOptions {
    entityType: EntitySummaryEntityType;
    entityId: number;
    initialSummary?: EntitySummaryPayload | null;
}

interface UseEntityAiSummaryResult {
    summary: EntitySummaryPayload | null;
    loading: boolean;
    error: string | null;
    isStale: boolean;
    regenerate: () => Promise<void>;
    generate: () => Promise<void>;
}

function summaryEndpoints(
    entityType: EntitySummaryEntityType,
    entityId: number,
) {
    if (entityType === "lead") {
        return {
            show: route("lead-contact.ai-summary", entityId),
            regenerate: route("lead-contact.ai-summary.regenerate", entityId),
        };
    }

    if (entityType === "deal") {
        return {
            show: route("deals.ai-summary", entityId),
            regenerate: route("deals.ai-summary.regenerate", entityId),
        };
    }

    throw new Error(`Unsupported entity type: ${entityType}`);
}

export default function useEntityAiSummary({
    entityType,
    entityId,
    initialSummary = null,
}: UseEntityAiSummaryOptions): UseEntityAiSummaryResult {
    const [summary, setSummary] = useState<EntitySummaryPayload | null>(
        initialSummary ?? null,
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isStale, setIsStale] = useState<boolean>(
        Boolean(initialSummary?.meta?.is_stale),
    );
    const hydratedRef = useRef(false);
    const inFlightRef = useRef(false);

    const applySummary = useCallback((next: EntitySummaryPayload | null) => {
        setSummary(next);
        setIsStale(Boolean(next?.meta?.is_stale));
    }, []);

    useEffect(() => {
        applySummary(initialSummary ?? null);
    }, [initialSummary, applySummary]);

    useEffect(() => {
        if (hydratedRef.current) return;
        if (initialSummary) {
            hydratedRef.current = true;
            return;
        }

        hydratedRef.current = true;
        let cancelled = false;

        (async () => {
            try {
                const endpoints = summaryEndpoints(entityType, entityId);
                const response = await axios.get<{
                    summary: LeadSummaryPayload | DealSummaryPayload | null;
                    is_stale?: boolean;
                }>(endpoints.show, { timeout: 15000 });

                if (cancelled) return;
                applySummary(response.data.summary ?? null);
                if (typeof response.data.is_stale === "boolean") {
                    setIsStale(response.data.is_stale);
                }
            } catch {
                // Keep empty state; user can still generate.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [applySummary, entityId, entityType, initialSummary]);

    const regenerate = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const endpoints = summaryEndpoints(entityType, entityId);
            const response = await axios.post<{
                summary: LeadSummaryPayload | DealSummaryPayload;
                is_stale?: boolean;
                message?: string;
            }>(endpoints.regenerate, {}, { timeout: 60000 });
            applySummary(response.data.summary);
            setIsStale(false);
        } catch (err) {
            if (axios.isAxiosError(err)) {
                const payload = err.response?.data as
                    | {
                          message?: string;
                          summary?: EntitySummaryPayload | null;
                      }
                    | undefined;

                if (payload?.summary) {
                    applySummary(payload.summary);
                }

                setError(
                    payload?.message ||
                        (err.response?.status === 429
                            ? "Too many requests. Please wait and try again."
                            : "Failed to generate AI summary. Please try again."),
                );
            } else {
                setError("Failed to generate AI summary. Please try again.");
            }
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }, [applySummary, entityId, entityType]);

    const generate = regenerate;

    return {
        summary,
        loading,
        error,
        isStale,
        regenerate,
        generate,
    };
}
