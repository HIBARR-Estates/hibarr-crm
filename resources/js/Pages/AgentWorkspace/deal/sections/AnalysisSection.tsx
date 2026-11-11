import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { AnalysisProgress } from "@/Pages/Deals/Redesign/components/analysis/analysisProgress";
import SectionCard, { SectionEmpty } from "./SectionCard";

interface AnalysisSectionProps {
    pipelineName: string | null;
    progress: AnalysisProgress;
    /** Opens the analysis under the dock; left out when the analysis flag is off. */
    onContinue?: () => void;
    complete: boolean;
}

/**
 * Where the deal's analysis stands: answered of total, a bar, the sections
 * done in one line and each section still open. It only opens when the agent
 * asks; nothing here starts it.
 */
export default function AnalysisSection({ pipelineName, progress, onContinue, complete }: AnalysisSectionProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { totalFilled, totalFields } = progress;
    const counted = progress.sections.filter((section) => (progress.sectionProgress[section.id]?.total ?? 0) > 0);
    const isDone = (id: string) => {
        const entry = progress.sectionProgress[id];
        return entry !== undefined && entry.total > 0 && entry.filled >= entry.total;
    };
    const done = counted.filter((section) => isDone(section.id));
    const open = counted.filter((section) => !isDone(section.id));
    const percent = totalFields > 0 ? Math.min(100, Math.round((totalFilled / totalFields) * 100)) : 0;

    return (
        <SectionCard
            id="deal-analysis"
            title={[t("pages.agent_workspace.deal.analysis.title"), pipelineName ? td(pipelineName, { source: "en" }) : ""].filter(Boolean).join(" · ")}
        >
            {totalFields === 0 ? (
                <SectionEmpty>{t("pages.agent_workspace.deal.analysis.empty")}</SectionEmpty>
            ) : (
                <div className="agent-deal__analysis">
                    <div className="agent-deal__analysis-head">
                        <span className="agent-deal__analysis-count">
                            {t("pages.agent_workspace.deal.analysis.answered", { done: totalFilled, total: totalFields })}
                        </span>
                        {onContinue ? (
                            <button type="button" className="agent-deal__continue" onClick={onContinue}>
                                <span aria-hidden="true">▶</span>
                                {complete ? t("pages.agent_workspace.deal.analysis.review") : t("pages.agent_workspace.deal.analysis.continue")}
                            </button>
                        ) : null}
                    </div>
                    <div className="agent-deal__meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                        <span style={{ width: `${percent}%` }} />
                    </div>
                    <ul className="agent-deal__checks">
                        {done.length > 0 ? (
                            <li className="agent-deal__check agent-deal__check--done">
                                <Icon name="check" size={13} />
                                <span>{done.map((section) => td(section.title, { source: "en" })).join(", ")}</span>
                            </li>
                        ) : null}
                        {open.map((section) => (
                            <li key={section.id} className="agent-deal__check">
                                <span className="agent-deal__circle" aria-hidden="true" />
                                <span>{td(section.title, { source: "en" })}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="agent-deal__hint">{t("pages.agent_workspace.deal.analysis.hint")}</p>
                </div>
            )}
        </SectionCard>
    );
}
