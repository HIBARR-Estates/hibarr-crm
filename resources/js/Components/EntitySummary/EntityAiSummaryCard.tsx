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
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <section className={cardClassName}>
            <EntityAiSummaryHeader
                title={TITLES[entityType]}
                generatedAt={summary?.meta?.generated_at}
                loading={loading}
                onRegenerate={summary ? regenerate : generate}
                dataConfidence={summary?.meta?.data_confidence}
            />

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
                        Generate an AI summary to see key facts, risk signals,
                        and a suggested next step for this {entityType}.
                    </p>
                    <button
                        type="button"
                        className="entity-ai-summary-next-step__button"
                        style={{
                            marginTop: 12,
                            background: "#7c3aed",
                            color: "#fff",
                        }}
                        onClick={generate}
                    >
                        Generate AI Summary
                    </button>
                </div>
            )}

            {summary && !loading && !error && (
                <>
                    <div className="entity-ai-summary-body">
                        <p
                            className={`entity-ai-summary-status-line${
                                showRiskHighlight
                                    ? " entity-ai-summary-status-line--risk"
                                    : ""
                            }`}
                        >
                            {summary.status_line}
                        </p>
                        <EntityAiSummaryChipGrid chips={summary.chips} />
                        {summary.bullets.length > 0 && (
                            <ul className="entity-ai-summary-bullets">
                                {summary.bullets.map((bullet) => (
                                    <li key={bullet}>{bullet}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <EntityAiSummaryNextStep
                        nextStep={summary.next_step}
                        onAction={handleAction}
                    />
                </>
            )}
        </section>
    );
}
