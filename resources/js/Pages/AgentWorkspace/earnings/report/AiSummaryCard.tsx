import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import type { SaveState } from "./useReportSummary";
import type { ReportRange } from "./types";

interface AiSummaryCardProps {
    range: ReportRange;
    /** "November so far", "last week": what the summary covers. */
    periodName: string;
    summary: string | undefined;
    loading: boolean;
    error: "timeout" | "failed" | null;
    save: SaveState;
    onGenerate: (refresh: boolean) => void;
    onSave: () => void;
}

/**
 * The AI summary (L7-38): a few sentences on the agent's own notes for the
 * period, generated when asked for. The same service and the same markdown
 * the classic Agent Reports screen uses; "Save AI Summary as Note" files it
 * with the other saved summaries.
 */
export default function AiSummaryCard({ periodName, summary, loading, error, save, onGenerate, onSave }: AiSummaryCardProps) {
    const { t } = useTranslation();
    const html = useMemo(() => (summary ? DOMPurify.sanitize(marked.parse(summary, { breaks: true, gfm: true }) as string) : ""), [summary]);

    return (
        <section className="agent-ea__ai" aria-label={t("pages.agent_workspace.earnings.report.ai.label")} aria-busy={loading}>
            <div className="agent-ea__ai-head">
                <span className="agent-ea__ai-title">
                    <span className="agent-ea__ai-badge" aria-hidden="true">
                        AI
                    </span>
                    <b>{t("pages.agent_workspace.earnings.report.ai.title", { period: periodName })}</b>
                </span>
                <span className="agent-ea__ai-actions">
                    {summary ? (
                        <>
                            <button type="button" className="agent-ea__btn" disabled={loading} onClick={() => onGenerate(true)}>
                                <Icon name="refresh" size={13} />
                                {t("pages.agent_workspace.earnings.report.ai.regenerate")}
                            </button>
                            <button type="button" className="agent-ea__btn agent-ea__btn--ghost" disabled={loading || save === "saving" || save === "saved"} onClick={onSave}>
                                <Icon name={save === "saved" ? "check" : "file-text"} size={13} />
                                {save === "saved" ? t("pages.agent_workspace.earnings.report.ai.saved") : t("pages.agent_workspace.earnings.report.ai.save")}
                            </button>
                        </>
                    ) : (
                        <button type="button" className="agent-ea__btn" disabled={loading} onClick={() => onGenerate(false)}>
                            <Icon name="spark" size={13} />
                            {loading ? t("pages.agent_workspace.earnings.report.ai.generating") : t("pages.agent_workspace.earnings.report.ai.generate")}
                        </button>
                    )}
                </span>
            </div>

            {loading && !summary ? (
                <div className="agent-ea__ai-skeleton" aria-hidden="true">
                    <i />
                    <i />
                </div>
            ) : summary ? (
                <div className="agent-ea__ai-body" dangerouslySetInnerHTML={{ __html: html }} />
            ) : (
                <p className="agent-ea__ai-empty">{t("pages.agent_workspace.earnings.report.ai.empty")}</p>
            )}

            {error ? (
                <p className="agent-ea__ai-error" role="alert">
                    {t(error === "timeout" ? "pages.agent_workspace.earnings.report.ai.timeout" : "pages.agent_workspace.earnings.report.ai.failed")}
                </p>
            ) : null}
            {save === "failed" ? (
                <p className="agent-ea__ai-error" role="alert">
                    {t("pages.agent_workspace.earnings.report.ai.save_failed")}
                </p>
            ) : null}
        </section>
    );
}
