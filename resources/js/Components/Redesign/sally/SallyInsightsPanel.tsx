import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import SallyInsightCard from "@/Components/Redesign/sally/SallyInsightCard";
import useSallyInsightMutations from "@/Components/Redesign/sally/useSallyInsightMutations";
import type { Deal } from "@/Types/api/deals";
import type { SallyMeetingInsight } from "@/Types/api/sally-meeting-insight";

interface SallyInsightsPanelProps {
    insights: SallyMeetingInsight[];
    loading: boolean;
    /** A failed request must read as "couldn't load", not as an empty list. */
    error?: boolean;
    onRetry?: () => void;
    /**
     * Pass the entity's deals to label each card with the deal it came from —
     * on the lead page an insight is usually attached to one of the lead's
     * deals, not to the lead itself.
     */
    groupByDeal?: Deal[];
    /**
     * Enables the summary's inline edit; omit for a read-only panel. Each card
     * owns its own mutation, since the update route is keyed by insight id.
     */
    patchSummary?: (insightId: number, summary: string | null) => void;
    emptyTitle?: string;
    emptyDescription?: string;
}

export default function SallyInsightsPanel({
    insights,
    loading,
    error = false,
    onRetry,
    groupByDeal,
    patchSummary,
    emptyTitle,
    emptyDescription,
}: SallyInsightsPanelProps) {
    const { t } = useTranslation();

    const dealNameById = useMemo(() => {
        const map = new Map<number, string>();
        for (const deal of groupByDeal ?? []) {
            map.set(deal.id, deal.name?.trim() || "");
        }
        return map;
    }, [groupByDeal]);

    if (error && insights.length === 0) {
        return (
            <EmptyState
                role="alert"
                icon="info"
                title={t("pages.deals.sally.load_failed")}
                description={t("pages.deals.sally.load_failed_hint")}
                action={
                    onRetry
                        ? {
                              label: t("pages.deals.sally.retry"),
                              onClick: onRetry,
                              icon: null,
                          }
                        : undefined
                }
            />
        );
    }

    if (loading && insights.length === 0) {
        return (
            <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div
                        key={index}
                        className="h-32 animate-pulse rounded-xl bg-dr-skeleton"
                    />
                ))}
            </div>
        );
    }

    if (insights.length === 0) {
        return (
            <EmptyState
                icon="bot"
                title={emptyTitle ?? t("pages.deals.sally.empty_title")}
                description={
                    emptyDescription ?? t("pages.deals.sally.empty_description")
                }
            />
        );
    }

    return (
        <div className="space-y-3">
            {insights.map((insight) => (
                <SallyInsightCard
                    key={insight.id}
                    insight={insight}
                    groupLabel={
                        insight.deal_id
                            ? dealNameById.get(insight.deal_id) ||
                              t("pages.deals.sally.deal_fallback")
                            : undefined
                    }
                    onSummaryChange={patchSummary}
                />
            ))}
        </div>
    );
}
