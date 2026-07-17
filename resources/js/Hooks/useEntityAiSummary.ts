import { useCallback, useState } from "react";
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
    regenerate: () => Promise<void>;
    generate: () => Promise<void>;
}

function summaryEndpoint(entityType: EntitySummaryEntityType, entityId: number) {
    if (entityType === "lead") {
        return {
            regenerate: route("lead-contact.ai-summary.regenerate", entityId),
        };
    }

    if (entityType === "deal") {
        return {
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

    const regenerate = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const endpoints = summaryEndpoint(entityType, entityId);
            const response = await axios.post<{
                summary: LeadSummaryPayload | DealSummaryPayload;
            }>(endpoints.regenerate, {}, { timeout: 60000 });
            setSummary(response.data.summary);
        } catch {
            setError("Failed to generate AI summary. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [entityId, entityType]);

    const generate = regenerate;

    return {
        summary,
        loading,
        error,
        regenerate,
        generate,
    };
}
