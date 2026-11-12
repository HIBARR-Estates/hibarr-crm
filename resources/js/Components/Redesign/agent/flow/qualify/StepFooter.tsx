import type { ReactNode } from "react";
import type { Segment } from "@/Types/qualification";
import useTranslation from "@/Hooks/useTranslation";
import type useQualificationFlow from "@/Pages/Leads/Components/Qualification/useQualificationFlow";
import { stripHtmlTags } from "@/Components/Redesign/qualification/qualificationUtils";
import { useTranslatedScriptLabel } from "@/Components/Redesign/qualification/useTranslatedScriptLabel";
import useSavedAgo from "./useSavedAgo";
import "./agent-qualify.css";

type QualificationFlow = ReturnType<typeof useQualificationFlow>;

/** A step's name in the agent's script language. */
export function StepName({ segment, translateScript }: { segment: Segment; translateScript: (text: string) => string }) {
    const raw = useTranslatedScriptLabel(segment.label || segment.key);
    return <>{stripHtmlTags(translateScript(raw)) || segment.key}</>;
}

interface StepFooterProps {
    flow: QualificationFlow;
    /** On the last step "Next" opens the outcome. */
    isLast: boolean;
    onNext: (options?: { skipValidation?: boolean }) => void | Promise<void>;
}

/**
 * Under the step (canvas L7-07): back to the step before, when the answers were
 * last saved, and on to the next step by name. A required question that is still
 * empty blocks Next; Skip steps past it anyway, as the classic footer allows.
 */
export default function StepFooter({ flow, isLast, onNext }: StepFooterProps) {
    const { t } = useTranslation();
    const saved = useSavedAgo(flow.subscribeSaving);
    if (!flow.currentSegment) return null;

    const previous = flow.walkIndex > 0 ? flow.walkSegments[flow.walkIndex - 1] : null;
    const next = !isLast ? flow.walkSegments[flow.walkIndex + 1] : null;
    const blocked = Boolean(flow.validationError);

    let nextLabel: ReactNode = t("pages.agent_workspace.flow.choose_outcome");
    if (next) {
        nextLabel = (
            <>
                {t("pages.agent_workspace.flow.next")}
                {": "}
                <span className="agent-qs__foot-name">
                    <StepName segment={next} translateScript={flow.translateScript} />
                </span>
            </>
        );
    }

    return (
        <footer className="agent-qs__foot">
            <button
                type="button"
                className="agent-qs__btn"
                disabled={!previous}
                onClick={() => previous && void flow.jumpToSegment(previous.key)}
            >
                <span aria-hidden="true">←</span>
                <span className="agent-qs__foot-name">
                    {previous ? (
                        <StepName segment={previous} translateScript={flow.translateScript} />
                    ) : (
                        t("pages.agent_workspace.flow.previous")
                    )}
                </span>
            </button>
            <span className="agent-qs__saved" aria-live="polite">
                {saved}
            </span>
            {blocked ? (
                <button type="button" className="agent-qs__btn" onClick={() => void onNext({ skipValidation: true })}>
                    {t("pages.agent_workspace.flow.skip")}
                </button>
            ) : null}
            <button
                type="button"
                className="agent-qs__btn agent-qs__btn--navy"
                disabled={blocked}
                onClick={() => void onNext()}
            >
                <span className="agent-qs__foot-name">{nextLabel}</span>
                <span aria-hidden="true">→</span>
            </button>
        </footer>
    );
}
