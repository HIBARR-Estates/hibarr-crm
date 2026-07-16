import { useState } from "react";
import { Skeleton } from "antd";
import useEntityAiSummary from "@/Hooks/useEntityAiSummary";
import type { EntityAiSummaryCardProps } from "@/Types/entity-summary";
import { isLeadSummaryPayload } from "@/Types/entity-summary";
import EntityAiSummaryChipGrid from "./EntityAiSummaryChipGrid";
import EntityAiSummaryHeader from "./EntityAiSummaryHeader";
import EntityAiSummaryNextStep from "./EntityAiSummaryNextStep";
import { executeSummaryAction } from "./summaryActions";
import "./entity-summary.css";

const TITLES: Record<EntityAiSummaryCardProps["entityType"], string> = {
    lead: "AI Lead Summary",
    deal: "AI Deal Summary",
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
    const [collapsed, setCollapsed] = useState(false);

    const { summary, loading, error, generate, regenerate } =
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
        isRedesign ? "section-card" : "my-4",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    // Redesign variant: collapsed shows only the header (status line + chip
    // preview live inside it); expanded reveals the detail grid/bullets/footer.
    const showDetailBody = !isRedesign || !collapsed;

    return (
        <section
            className={cardClassName}
            style={{ marginTop: "1.5rem", marginBottom: "1.5rem" }}
        >
            <EntityAiSummaryHeader
                title={TITLES[entityType]}
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
            />

            {showDetailBody && (
                <>
                    {loading && (
                        <div className="entity-ai-summary-body">
                            <Skeleton active paragraph={{ rows: 4 }} />
                        </div>
                    )}

                    {error && !loading && (
                        <div className="entity-ai-summary-error">
                            {error}{" "}
                            <button type="button" onClick={generate}>
                                Retry
                            </button>
                        </div>
                    )}

                    {!summary && !loading && !error && (
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

                    {summary && !loading && !error && (
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
                                            : "Regenerate summary"}
                                    </button>
                                )}
                            </div>
                            <EntityAiSummaryNextStep
                                nextStep={summary.next_step}
                                onAction={handleAction}
                            />
                        </>
                    )}
                </>
            )}
        </section>
    );
}
