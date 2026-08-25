import { useLayoutEffect, useRef, useState } from "react";
import useEntityAiSummary from "@/Hooks/useEntityAiSummary";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { EntityAiSummaryCardProps } from "@/Types/entity-summary";
import { isLeadSummaryPayload } from "@/Types/entity-summary";
import AiThinkingIndicator from "./AiThinkingIndicator";
import EntityAiSummaryChipGrid from "./EntityAiSummaryChipGrid";
import EntityAiSummaryHeader from "./EntityAiSummaryHeader";
import EntityAiSummaryNextStep from "./EntityAiSummaryNextStep";
import { executeSummaryAction, isExecutableAction } from "./summaryActions";
import "./entity-summary.css";

const TITLE_KEYS: Record<EntityAiSummaryCardProps["entityType"], string> = {
    lead: "pages.entity_summary.title_lead",
    deal: "pages.entity_summary.title_deal",
};

export default function EntityAiSummaryCard({
    entityType,
    entityId,
    initialSummary = null,
    variant = "legacy",
    className = "my-4",
    leadPhone,
    onQualifyLead,
    onCreateTask,
    onScheduleCall,
    onRequestDocuments,
    onAdvanceStage,
    onReviewStaleDeal,
}: EntityAiSummaryCardProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const isRedesign = variant === "redesign";
    const [collapsed, setCollapsed] = useState(isRedesign);

    const { summary, loading, error, errorFromApi, isStale, generate, regenerate } =
        useEntityAiSummary({
            entityType,
            entityId,
            initialSummary,
        });

    const wasLoadingRef = useRef(false);

    // Expand before paint when generation finishes (or while regenerating) so
    // the result never lands behind a collapsed header after the spinner stops.
    useLayoutEffect(() => {
        if (!isRedesign) {
            wasLoadingRef.current = loading;
            return;
        }

        // First generate / regenerate: open the card so the loader is visible.
        if (loading) {
            setCollapsed(false);
        }

        if (wasLoadingRef.current && !loading && summary) {
            setCollapsed(false);
        }

        wasLoadingRef.current = loading;
    }, [isRedesign, loading, summary]);

    const showRiskHighlight =
        summary &&
        (summary.risk_level === "high" || summary.risk_level === "medium") &&
        (entityType === "deal" ||
            (isLeadSummaryPayload(summary) &&
                summary.primary_risk_source === "linked_deal"));

    const isHeuristic = summary?.meta?.source === "heuristic";

    const handleAction = () => {
        if (!summary) return;
        executeSummaryAction({
            nextStep: summary.next_step,
            entityType,
            entityId,
            leadPhone,
            onQualifyLead,
            onCreateTask,
            onScheduleCall,
            onRequestDocuments,
            onAdvanceStage,
            onReviewStaleDeal,
        });
    };

    const startGenerate = () => {
        void generate();
    };

    const startRegenerate = () => {
        // Keep the prior summary visible under a thinking banner.
        if (isRedesign) setCollapsed(false);
        void regenerate();
    };

    const cardClassName = [
        "entity-ai-summary-card",
        `entity-ai-summary-card--${variant}`,
        entityType === "deal" ? "entity-ai-summary-card--deal" : "",
        isStale ? "entity-ai-summary-card--stale" : "",
        loading ? "entity-ai-summary-card--loading" : "",
        isRedesign ? "section-card" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const showDetailBody = !isRedesign || !collapsed;

    return (
        <section className={cardClassName} aria-busy={loading || undefined}>
            <EntityAiSummaryHeader
                title={t(TITLE_KEYS[entityType])}
                entityType={entityType}
                generatedAt={summary?.meta?.generated_at}
                loading={loading}
                onRegenerate={summary ? startRegenerate : startGenerate}
                dataConfidence={
                    isStale ? undefined : summary?.meta?.data_confidence
                }
                variant={variant}
                collapsed={collapsed}
                onToggleCollapse={
                    isRedesign
                        ? () => setCollapsed((value) => !value)
                        : undefined
                }
                statusLine={isRedesign ? summary?.status_line : undefined}
                riskLevel={isRedesign ? summary?.risk_level : undefined}
                chips={isRedesign ? summary?.chips : undefined}
                hasSummary={Boolean(summary)}
                isStale={isStale}
                isHeuristic={isHeuristic}
            />

            {showDetailBody && (
                <>
                    {loading && (
                        <div className="entity-ai-summary-loading-banner">
                            <AiThinkingIndicator
                                variant={isRedesign ? "panel" : "inline"}
                            />
                        </div>
                    )}

                    {error && !loading && (
                        <div className="entity-ai-summary-error" role="alert">
                            {isRedesign && errorFromApi
                                ? td(error, { source: "en" })
                                : error}{" "}
                            <button type="button" onClick={startGenerate}>
                                {isRedesign
                                    ? t("pages.entity_summary.retry")
                                    : "Retry"}
                            </button>
                        </div>
                    )}

                    {isStale && summary && !loading && (
                        <div className="entity-ai-summary-stale-banner">
                            {isRedesign ? (
                                <>
                                    {t("pages.entity_summary.stale_banner", {
                                        entity: entityType,
                                    })}{" "}
                                    <button type="button" onClick={startRegenerate}>
                                        {t("pages.entity_summary.refresh")}
                                    </button>
                                </>
                            ) : (
                                <>
                                    This summary may be out of date because the{" "}
                                    {entityType} changed.{" "}
                                    <button type="button" onClick={startRegenerate}>
                                        Refresh
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {isHeuristic && summary && !loading && !error && (
                        <div className="entity-ai-summary-heuristic-banner">
                            {isRedesign ? (
                                <>
                                    {t("pages.entity_summary.heuristic_banner")}{" "}
                                    <button type="button" onClick={startRegenerate}>
                                        {t("pages.entity_summary.retry_ai")}
                                    </button>
                                </>
                            ) : (
                                <>
                                    Showing a fallback summary because AI was
                                    unavailable.{" "}
                                    <button type="button" onClick={startRegenerate}>
                                        Retry AI
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {!isRedesign && !summary && !loading && !error && (
                        <div className="entity-ai-summary-empty">
                            <p>
                                Generate an AI summary to see key facts, risk
                                signals, and a suggested next step for this{" "}
                                {entityType}.
                            </p>
                            <button
                                type="button"
                                className="entity-ai-summary-next-step__button entity-ai-summary-empty__cta"
                                onClick={startGenerate}
                            >
                                Generate AI Summary
                            </button>
                        </div>
                    )}

                    {/* Keep prior summary mounted while regenerating so loading
                        never blanks the card; swap in place when the new one
                        arrives with loading already cleared. */}
                    {summary && !loading && (
                        <div className="entity-ai-summary-result">
                            <div className="entity-ai-summary-body">
                                {!isRedesign && (
                                    <p
                                        className={`entity-ai-summary-status-line${
                                            showRiskHighlight
                                                ? " entity-ai-summary-status-line--risk"
                                                : ""
                                        }`}
                                    >
                                        {summary.status_line}
                                    </p>
                                )}
                                <EntityAiSummaryChipGrid
                                    chips={summary.chips}
                                />
                                {summary.bullets.length > 0 && (
                                    <ul className="entity-ai-summary-bullets">
                                        {summary.bullets.map((bullet) => (
                                            <li key={bullet}>
                                                {td(bullet, { source: "en" })}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {isRedesign && (
                                    <button
                                        type="button"
                                        className="entity-ai-summary-regenerate-btn"
                                        disabled={loading}
                                        onClick={startRegenerate}
                                    >
                                        {isStale
                                            ? t(
                                                  "pages.entity_summary.refresh_summary",
                                              )
                                            : t(
                                                  "pages.entity_summary.regenerate_summary",
                                              )}
                                    </button>
                                )}
                            </div>
                            <EntityAiSummaryNextStep
                                nextStep={summary.next_step}
                                onAction={handleAction}
                                actionable={isExecutableAction(
                                    summary.next_step.action_type,
                                    {
                                        canAdvanceStage:
                                            Boolean(onAdvanceStage),
                                    },
                                )}
                            />
                        </div>
                    )}

                    {/* Regenerating: show prior summary dimmed under the panel loader above. */}
                    {summary && loading && (
                        <div className="entity-ai-summary-result entity-ai-summary-result--pending">
                            <div className="entity-ai-summary-body">
                                <EntityAiSummaryChipGrid
                                    chips={summary.chips}
                                />
                                {summary.bullets.length > 0 && (
                                    <ul className="entity-ai-summary-bullets">
                                        {summary.bullets.map((bullet) => (
                                            <li key={bullet}>
                                                {td(bullet, { source: "en" })}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
