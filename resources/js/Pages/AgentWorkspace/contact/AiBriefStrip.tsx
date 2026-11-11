import { useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import { buildLeadTokenValues, personalizeSummaryText } from "@/Components/EntitySummary/summaryTokens";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useEntityAiSummary from "@/Hooks/useEntityAiSummary";
import useTranslation from "@/Hooks/useTranslation";
import type { EntityAiSummaryCardProps, EntitySummaryPayload } from "@/Types/entity-summary";
import { isLeadSummaryPayload } from "@/Types/entity-summary";

dayjs.extend(relativeTime);

type BriefActions = Pick<
    EntityAiSummaryCardProps,
    "onCreateTask" | "onScheduleCall" | "onRequestDocuments" | "onAdvanceStage" | "onReviewStaleDeal" | "onQualifyLead"
>;

interface AiBriefStripProps extends BriefActions {
    entityType: "lead" | "deal";
    entityId: number;
    initialSummary: EntitySummaryPayload | null | undefined;
    /** The person's name; the summary refers to them by token. */
    leadName: string | null | undefined;
    leadPhone?: string | null;
}

/** The text of a summary as one short paragraph: the written brief, or the status line and bullets. */
function briefText(summary: EntitySummaryPayload): string {
    if (isLeadSummaryPayload(summary) && summary.summary) return summary.summary;
    return [summary.status_line, ...(summary.bullets ?? [])].filter(Boolean).join(". ");
}

/**
 * The AI summary as one strip under the person's header (canvas L7-05/L7-10):
 * the brief in a few lines, how old it is, Open brief for the full summary and
 * a refresh. A summary is never written by opening the page; refresh asks for
 * a new one.
 */
export default function AiBriefStrip({ entityType, entityId, initialSummary, leadName, leadPhone, ...actions }: AiBriefStripProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const [open, setOpen] = useState(false);
    // The full brief is a second card with its own state; when it writes a newer
    // summary the strip follows, so closing and reopening shows the latest.
    const [fromCard, setFromCard] = useState<EntitySummaryPayload | null>(null);
    const { summary: own, loading, error, generate, regenerate } = useEntityAiSummary({
        entityType,
        entityId,
        initialSummary,
        autoGenerate: false,
    });
    const generatedAt = (item: EntitySummaryPayload | null) => Date.parse(item?.meta?.generated_at ?? "") || 0;
    const summary = fromCard && generatedAt(fromCard) > generatedAt(own) ? fromCard : own;
    const tokens = buildLeadTokenValues(leadName);
    const text = summary ? personalizeSummaryText(td(briefText(summary), { source: "en" }), tokens).replace(/\*\*|==/g, "") : "";
    const age = summary?.meta?.generated_at ? dayjs(summary.meta.generated_at).fromNow(true) : null;
    const refresh = () => void (summary ? regenerate() : generate());

    // The full card's calls to action close the dialog first, then act.
    const closing =
        (fn?: () => void) =>
        fn
            ? () => {
                  setOpen(false);
                  fn();
              }
            : undefined;

    return (
        <>
            <div className="agent-brief" aria-busy={loading || undefined}>
                <span className="agent-brief__badge">AI</span>
                <p className="agent-brief__text">
                    {loading
                        ? t("pages.agent_workspace.contact.ai.writing")
                        : text || error || t("pages.agent_workspace.contact.ai.none")}
                    {age && !loading ? (
                        <span className="agent-brief__age"> · {t("pages.agent_workspace.contact.ai.age", { age })}</span>
                    ) : null}
                </p>
                <span className="agent-brief__actions">
                    {summary ? (
                        <button type="button" className="agent-brief__open" onClick={() => setOpen(true)}>
                            <Icon name="file-text" size={13} />
                            {t("pages.agent_workspace.contact.ai.open")}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        className={`agent-brief__refresh${summary ? "" : " agent-brief__refresh--text"}`}
                        onClick={refresh}
                        disabled={loading}
                        aria-label={t("pages.agent_workspace.contact.ai.refresh")}
                        title={t("pages.agent_workspace.contact.ai.refresh")}
                    >
                        <Icon name="refresh" size={13} />
                        {summary ? null : t("pages.agent_workspace.contact.ai.generate")}
                    </button>
                </span>
            </div>
            <Modal
                open={open}
                title={t(entityType === "deal" ? "pages.entity_summary.title_deal" : "pages.entity_summary.title_lead")}
                onClose={() => setOpen(false)}
                maxWidth={760}
                closeOnBackdrop
            >
                {open ? (
                    <EntityAiSummaryCard
                        entityType={entityType}
                        entityId={entityId}
                        initialSummary={summary}
                        variant="legacy"
                        className="agent-brief__full"
                        onSummaryChange={setFromCard}
                        leadName={leadName}
                        leadPhone={leadPhone}
                        onQualifyLead={closing(actions.onQualifyLead)}
                        onCreateTask={closing(actions.onCreateTask)}
                        onScheduleCall={closing(actions.onScheduleCall)}
                        onRequestDocuments={closing(actions.onRequestDocuments)}
                        onAdvanceStage={closing(actions.onAdvanceStage)}
                        onReviewStaleDeal={closing(actions.onReviewStaleDeal)}
                    />
                ) : null}
            </Modal>
        </>
    );
}
