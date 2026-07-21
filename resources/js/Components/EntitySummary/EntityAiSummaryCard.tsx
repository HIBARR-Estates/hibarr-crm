import { useState } from "react";
import useEntityAiSummary from "@/Hooks/useEntityAiSummary";
import type { EntityAiSummaryCardProps } from "@/Types/entity-summary";
import { isLeadSummaryPayload } from "@/Types/entity-summary";
import AiThinkingIndicator from "./AiThinkingIndicator";
import EntityAiSummaryChipGrid from "./EntityAiSummaryChipGrid";
import EntityAiSummaryHeader from "./EntityAiSummaryHeader";
import EntityAiSummaryNextStep from "./EntityAiSummaryNextStep";
import { executeSummaryAction, isExecutableAction } from "./summaryActions";
import "./entity-summary.css";

const TITLES: Record<EntityAiSummaryCardProps["entityType"], string> = {
    lead: "AI Lead Summary",
    deal: "AI Summary",
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
    const isRedesign = variant === "redesign";
    const [collapsed, setCollapsed] = useState(isRedesign);

    const { summary, loading, error, isStale, generate, regenerate } =
        useEntityAiSummary({
            entityType,
            entityId,
            initialSummary,
        });

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

    const cardClassName = [
        "entity-ai-summary-card",
        `entity-ai-summary-card--${variant}`,
        entityType === "deal" ? "entity-ai-summary-card--deal" : "",
        isStale ? "entity-ai-summary-card--stale" : "",
        isRedesign ? "section-card" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    const showDetailBody = !isRedesign || !collapsed;

    return (
        <section className={cardClassName}>
            <EntityAiSummaryHeader
                title={TITLES[entityType]}
                entityType={entityType}
                generatedAt={summary?.meta?.generated_at}
                loading={loading}
                onRegenerate={summary ? regenerate : generate}
                dataConfidence={summary?.meta?.data_confidence}
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
                    {loading && <AiThinkingIndicator />}

                    {error && !loading && (
                        <div className="entity-ai-summary-error" role="alert">
                            {error}{" "}
                            <button type="button" onClick={generate}>
                                Retry
                            </button>
                        </div>
                    )}

                    {isStale && summary && !loading && (
                        <div className="entity-ai-summary-stale-banner">
                            This summary may be out of date because the{" "}
                            {entityType} changed.{" "}
                            <button type="button" onClick={regenerate}>
                                Refresh
                            </button>
                        </div>
                    )}

                    {isHeuristic && summary && !loading && !error && (
                        <div className="entity-ai-summary-heuristic-banner">
                            Showing a fallback summary because AI was
                            unavailable.{" "}
                            <button type="button" onClick={regenerate}>
                                Retry AI
                            </button>
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
                                onClick={generate}
                            >
                                Generate AI Summary
                            </button>
                        </div>
                    )}

                    {summary && !loading && (
                        <>
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
                                            <li key={bullet}>{bullet}</li>
                                        ))}
                                    </ul>
                                )}
                                {isRedesign && (
                                    <button
                                        type="button"
                                        className="entity-ai-summary-regenerate-btn"
                                        disabled={loading}
                                        onClick={regenerate}
                                    >
                                        {loading
                                            ? "Regenerating…"
                                            : isStale
                                              ? "Refresh summary"
                                              : "Regenerate summary"}
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
                        </>
                    )}
                </>
            )}
        </section>
    );
}
