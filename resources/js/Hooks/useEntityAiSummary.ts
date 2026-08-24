import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import useTranslation from "@/Hooks/useTranslation";
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
    errorFromApi: boolean;
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

function generatedAtMs(summary: EntitySummaryPayload | null | undefined): number {
    const raw = summary?.meta?.generated_at;
    if (!raw) return 0;
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : 0;
}

export default function useEntityAiSummary({
    entityType,
    entityId,
    initialSummary = null,
}: UseEntityAiSummaryOptions): UseEntityAiSummaryResult {
    const { t } = useTranslation();
    const [summary, setSummary] = useState<EntitySummaryPayload | null>(
        initialSummary ?? null,
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorFromApi, setErrorFromApi] = useState(false);
    const [isStale, setIsStale] = useState<boolean>(
        Boolean(initialSummary?.meta?.is_stale),
    );
    const inFlightRef = useRef(false);
    // Tracks the newest summary we've accepted locally (generated or fetched)
    // so a stale Inertia prop can't wipe a just-finished generation.
    const localGeneratedAtRef = useRef(generatedAtMs(initialSummary));
    const entityKeyRef = useRef(`${entityType}:${entityId}`);

    const applySummary = useCallback((next: EntitySummaryPayload | null) => {
        localGeneratedAtRef.current = generatedAtMs(next);
        setSummary(next);
        setIsStale(Boolean(next?.meta?.is_stale));
    }, []);

    // Reset when navigating to a different entity.
    useEffect(() => {
        const key = `${entityType}:${entityId}`;
        if (entityKeyRef.current === key) return;
        entityKeyRef.current = key;
        localGeneratedAtRef.current = generatedAtMs(initialSummary);
        setSummary(initialSummary ?? null);
        setIsStale(Boolean(initialSummary?.meta?.is_stale));
        setError(null);
        setErrorFromApi(false);
        setLoading(false);
        inFlightRef.current = false;
    }, [entityType, entityId, initialSummary]);

    // Hydrate from page props only when they are newer than what we already
    // have locally — never clobber a summary the user just generated.
    useEffect(() => {
        if (!initialSummary) return;
        const incoming = generatedAtMs(initialSummary);
        if (incoming < localGeneratedAtRef.current) return;
        if (incoming === localGeneratedAtRef.current) {
            setIsStale(Boolean(initialSummary.meta?.is_stale));
            return;
        }
        applySummary(initialSummary);
    }, [initialSummary, applySummary]);

    useEffect(() => {
        if (initialSummary) return;

        let cancelled = false;

        (async () => {
            try {
                const endpoints = summaryEndpoints(entityType, entityId);
                const response = await axios.get<{
                    summary: LeadSummaryPayload | DealSummaryPayload | null;
                    is_stale?: boolean;
                }>(endpoints.show, { timeout: 15000 });

                if (cancelled) return;
                // Don't overwrite if the user already generated while we fetched.
                if (localGeneratedAtRef.current > 0) return;
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
        setErrorFromApi(false);

        try {
            const endpoints = summaryEndpoints(entityType, entityId);
            const response = await axios.post<{
                summary: LeadSummaryPayload | DealSummaryPayload;
                is_stale?: boolean;
                message?: string;
            }>(endpoints.regenerate, {}, { timeout: 60000 });

            // Apply result and clear loading in one turn so the UI never
            // flashes an empty/"done loading" gap before content mounts.
            localGeneratedAtRef.current = generatedAtMs(response.data.summary);
            setSummary(response.data.summary);
            setIsStale(false);
            setLoading(false);
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

                if (payload?.message) {
                    setError(payload.message);
                    setErrorFromApi(true);
                } else {
                    setError(
                        err.response?.status === 429
                            ? t("pages.entity_summary.error.too_many_requests")
                            : t("pages.entity_summary.error.generate_failed"),
                    );
                    setErrorFromApi(false);
                }
            } else {
                setError(t("pages.entity_summary.error.generate_failed"));
                setErrorFromApi(false);
            }
            setLoading(false);
        } finally {
            inFlightRef.current = false;
        }
    }, [applySummary, entityId, entityType, t]);

    const generate = regenerate;

    return {
        summary,
        loading,
        error,
        errorFromApi,
        isStale,
        regenerate,
        generate,
    };
}
